import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import {
  getSupabaseClient,
  upsertProfileFromEvent,
  activateEmailSubscription,
  insertEvent,
  mergeAnonymousToEmail,
} from '../../lib/clients/supabase';
import { addContactToResend } from '../../lib/clients';

/**
 * Handles subscriber.created events from Ghost
 * Creates a new email profile or merges with existing anonymous profile
 * 
 * Note: Ghost subscribers typically don't have anonymousId when they sign up
 * (they subscribe via email form). Identity merging usually happens later when they
 * browse the site and web events contain both email + anonymousId.
 */
export async function processGhostSubscriber(event: ProcessedEvent, env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);

  try {
    let profileId: string;

    // Check if event has anonymous ID (possible if subscriber came from website form)
    if (event.traits.anonymousId) {
      logger.debug('Subscriber has anonymous ID, merging identities', {
        email: event.identity_value,
        anonymousId: event.traits.anonymousId,
      });

      // Merge anonymous profile with email
      const mergeResult = await mergeAnonymousToEmail(
        supabase,
        event.identity_value,
        event.traits.anonymousId as string,
        {
          name: event.traits.name as string | undefined,
          status: event.traits.status as string | undefined,
        }
      );

      profileId = mergeResult.profile_id;

      logger.info('Merged anonymous profile with subscriber', {
        profileId,
        wasMerged: mergeResult.was_merged,
        wasNew: mergeResult.was_new_profile,
      });
    } else {
      // No anonymous ID - standard email profile upsert
      const profile = await upsertProfileFromEvent(supabase, event);
      profileId = profile.id;

      logger.debug('Email profile upserted', { profileId, email: profile.email });
    }

    // 2. Insert event
    await insertEvent(supabase, event);
    logger.debug('Event inserted', { eventType: event.type });

    // 3. Activate email subscription
    await activateEmailSubscription(supabase, profileId, event);
    logger.debug('Email subscription activated', { profileId });

    // 4. Sync to Resend Audience (if configured)
    if (env.RESEND_API_KEY && env.RESEND_AUDIENCE_ID) {
      try {
        await addContactToResend(
          env.RESEND_API_KEY,
          event.identity_value,
          profileId,
          env.RESEND_AUDIENCE_ID
        );
        logger.info('Synced subscriber to Resend Audience', { profileId });
      } catch (resendError) {
        // Log but don't fail the whole event processing
        logger.error('Failed to sync to Resend', { 
          error: resendError instanceof Error ? resendError.message : String(resendError) 
        });
      }
    }

    logger.info('Successfully processed subscriber.created event', {
      email: event.identity_value,
      profileId,
    });
  } catch (error) {
    logger.error('Failed to process subscriber.created event', {
      email: event.identity_value,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

