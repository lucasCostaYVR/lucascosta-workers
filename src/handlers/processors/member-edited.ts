import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import {
  getSupabaseClient,
  upsertProfileFromEvent,
  insertEvent,
} from '../../lib/clients/supabase';
import { addContactToResend } from '../../lib/clients';

/**
 * Handles member.edited events
 * Updates profile information without changing subscription status
 */
export async function processGhostMemberUpdate(event: ProcessedEvent, env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);

  try {
    // 1. Upsert profile
    const profile = await upsertProfileFromEvent(supabase, event);
    logger.debug('Profile upserted', { profileId: profile.id, email: profile.email });

    // 2. Insert event
    await insertEvent(supabase, event);
    logger.debug('Event inserted', { eventType: event.type });

    // 3. Sync to Resend Audience (if configured)
    if (env.RESEND_API_KEY && env.RESEND_AUDIENCE_ID) {
      try {
        await addContactToResend(
          env.RESEND_API_KEY,
          event.identity_value,
          profile.id,
          env.RESEND_AUDIENCE_ID
        );
        logger.info('Synced member update to Resend Audience', { profileId: profile.id });
      } catch (resendError) {
        // Log but don't fail the whole event processing
        logger.error('Failed to sync to Resend', { 
          error: resendError instanceof Error ? resendError.message : String(resendError) 
        });
      }
    }

    logger.info('Successfully processed member.edited event', {
      email: event.identity_value,
      profileId: profile.id,
    });

    // Note: We don't update subscription status for member.edited events
    // Subscription status only changes on subscribe/unsubscribe events
  } catch (error) {
    logger.error('Failed to process member.edited event', {
      email: event.identity_value,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
