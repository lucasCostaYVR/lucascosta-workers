import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import {
  getSupabaseClient,
  upsertProfileFromEvent,
  activateEmailSubscription,
  insertEvent,
} from '../../lib/clients/supabase';
import { addContactToResend, createTelegramClient } from '../../lib/clients';

/**
 * Handles newsletter.subscribed events
 * Updates existing profile and reactivates subscription
 */
export async function processNewsletterSubscription(event: ProcessedEvent, env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);
  const telegram = createTelegramClient(env);

  try {
    // 1. Upsert profile
    const profile = await upsertProfileFromEvent(supabase, event);
    logger.debug('Profile upserted', { profileId: profile.id, email: profile.email });

    // 2. Insert event
    await insertEvent(supabase, event);
    logger.debug('Event inserted', { eventType: event.type });

    // 3. Reactivate email subscription
    await activateEmailSubscription(supabase, profile.id, event);
    logger.debug('Email subscription reactivated', { profileId: profile.id });

    // 4. Sync to Resend Audience (if configured)
    if (env.RESEND_API_KEY && env.RESEND_AUDIENCE_ID) {
      try {
        await addContactToResend(
          env.RESEND_API_KEY,
          event.identity_value,
          profile.id,
          env.RESEND_AUDIENCE_ID
        );
        logger.info('Synced subscriber to Resend Audience', { profileId: profile.id });
      } catch (resendError) {
        // Log but don't fail the whole event processing
        logger.error('Failed to sync to Resend', { 
          error: resendError instanceof Error ? resendError.message : String(resendError) 
        });
      }
    }

    // 5. Send Telegram notification
    if (telegram) {
      try {
        const source = (event.traits as any).referrer || (event.raw as any)?.context?.page?.path || 'Unknown';
        await telegram.notify('📬', 'New Newsletter Signup', {
          'Email': event.identity_value,
          'Profile ID': profile.id,
          'Source': source
        });
      } catch (telegramError) {
        logger.error('Failed to send Telegram notification', {
          error: telegramError instanceof Error ? telegramError.message : String(telegramError)
        });
      }
    }

    logger.info('Successfully processed newsletter.subscribed event', {
      email: event.identity_value,
      profileId: profile.id,
    });
  } catch (error) {
    logger.error('Failed to process newsletter.subscribed event', {
      email: event.identity_value,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
