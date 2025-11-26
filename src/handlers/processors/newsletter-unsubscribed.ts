import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import {
  getSupabaseClient,
  upsertProfileFromEvent,
  deactivateEmailSubscription,
  insertEvent,
} from '../../lib/clients/supabase';

/**
 * Handles newsletter.unsubscribed events
 * Updates profile and marks subscription as inactive
 */
export async function processNewsletterUnsubscription(event: ProcessedEvent, env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);

  try {
    // 1. Upsert profile
    const profile = await upsertProfileFromEvent(supabase, event);
    logger.debug('Profile upserted', { profileId: profile.id, email: profile.email });

    // 2. Insert event
    await insertEvent(supabase, event);
    logger.debug('Event inserted', { eventType: event.type });

    // 3. Deactivate email subscription
    await deactivateEmailSubscription(supabase, profile.id, event);
    logger.debug('Email subscription deactivated', { profileId: profile.id });

    logger.info('Successfully processed newsletter.unsubscribed event', {
      email: event.identity_value,
      profileId: profile.id,
    });
  } catch (error) {
    logger.error('Failed to process newsletter.unsubscribed event', {
      email: event.identity_value,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
