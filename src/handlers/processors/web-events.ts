import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import {
  getSupabaseClient,
  insertEvent,
  mergeAnonymousToEmail,
  getOrCreateProfileByAnonymousId,
  linkAnonymousToProfileId,
  upsertProfileFromEvent,
} from '../../lib/clients/supabase';

/**
 * Handles web event queue messages
 * Processes web events (page views, clicks, etc.) from the queue
 * Also handles identity resolution/merging when email is present
 */
export async function processWebEvent(event: ProcessedEvent, env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);

  logger.debug('Processing web event from queue', {
    type: event.type,
    identity_type: event.identity_type,
    identity_value: event.identity_value,
    hasAnonymousId: !!event.traits.anonymousId,
  });

  try {
    // 1. Handle identity resolution
    
    // Case A: Magic Link (Profile ID + Anonymous ID)
    // The user clicked a link with ?uid=... and the pixel sent an identify event
    if (event.traits.profile_id && event.traits.anonymousId) {
      const profileId = event.traits.profile_id as string;
      const anonymousId = event.traits.anonymousId as string;

      logger.debug('Magic Link identity detected', { profileId, anonymousId });

      await linkAnonymousToProfileId(supabase, profileId, anonymousId);
      
      logger.info('Linked anonymous session to known profile via Magic Link', {
        profileId,
        anonymousId
      });
    }
    // Case B: Email Identification (Form Submit)
    else if (event.identity_type === 'email' && event.traits.anonymousId) {
      // User identified with email AND has anonymous ID → merge!
      logger.debug('Identity merge detected', {
        email: event.identity_value,
        anonymousId: event.traits.anonymousId,
      });

      const mergeResult = await mergeAnonymousToEmail(
        supabase,
        event.identity_value,
        event.traits.anonymousId as string,
        {
          name: event.traits.name as string | undefined,
          status: event.traits.status as string | undefined,
        }
      );

      // Explicitly upsert profile data to ensure name/status are updated
      // (The merge RPC might not update fields if profile already existed)
      if (event.traits.name || event.traits.status) {
        await upsertProfileFromEvent(supabase, event);
      }

      logger.info('Identity merge completed', {
        profileId: mergeResult.profile_id,
        wasNewProfile: mergeResult.was_new_profile,
        wasMerged: mergeResult.was_merged,
        email: event.identity_value,
        anonymousId: event.traits.anonymousId,
      });
    } 
    // Case C: Pure Anonymous
    else if (event.identity_type === 'anonymous_id') {
      // Pure anonymous user → ensure profile exists
      const profileId = await getOrCreateProfileByAnonymousId(
        supabase,
        event.identity_value
      );

      logger.debug('Anonymous profile resolved', {
        profileId,
        anonymousId: event.identity_value,
      });
    }
    // Case D: Email Only (No Anonymous ID)
    else if (event.identity_type === 'email') {
      // Just upsert the profile to ensure name/status are updated
      const profile = await upsertProfileFromEvent(supabase, event);
      
      logger.debug('Profile upserted (Email only)', {
        profileId: profile.id,
        email: event.identity_value
      });
    }

    // 2. Insert event for analytics
    // WITHOUT consent: Stored anonymously (identity_value = null) for aggregated metrics
    // WITH consent: Stored with profile linkage for personalization/journey tracking
    const hasConsent = event.traits?.hasConsent as boolean | undefined;
    const eventRecord = await insertEvent(supabase, event);

    logger.info('Successfully processed web event', {
      type: event.type,
      identity_type: event.identity_type,
      identity_value: event.identity_value,
      hasConsent: hasConsent,
      eventId: eventRecord?.id,
      mode: hasConsent ? 'linked-to-profile' : 'anonymous-aggregated'
    });
  } catch (error) {
    logger.error('Failed to process web event', {
      type: event.type,
      identity_type: event.identity_type,
      identity_value: event.identity_value,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

