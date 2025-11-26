import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import { getSupabaseClient, insertEvent, deactivateEmailSubscription, getProfileByEmail } from '../../lib/clients/supabase';
import { unsubscribeGhostMember } from '../../lib/clients';

export async function processResendEvent(event: ProcessedEvent, env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);

  try {
    // Insert into DB
    await insertEvent(supabase, event);
    logger.info('Resend event inserted into DB', { type: event.type });

    // Handle Unsubscribe / Bounce / Contact Unsubscribe
    const isUnsubscribe = 
        event.type === 'email.bounced' || 
        event.type === 'email.complained' || 
        (event.type === 'contact.updated' && event.traits.unsubscribed === true);

    if (isUnsubscribe) {
        logger.info('Processing unsubscribe/bounce', { 
            email: event.identity_value,
            reason: event.type
        });

        // 1. Update Local DB Subscription Status
        try {
          const profile = await getProfileByEmail(supabase, event.identity_value);
          if (profile) {
            await deactivateEmailSubscription(supabase, profile.id, event);
            logger.info('Deactivated email subscription in local DB', { profileId: profile.id });
          } else {
            logger.warn('Profile not found for unsubscribe event', { email: event.identity_value });
          }
        } catch (dbError) {
           logger.error('Failed to update local subscription status', {
             error: dbError instanceof Error ? dbError.message : String(dbError)
           });
        }
        
        // 2. Sync to Ghost (Legacy)
        try {
            await unsubscribeGhostMember(env, event.identity_value);
            logger.info('Successfully synced unsubscribe to Ghost', { email: event.identity_value });
        } catch (ghostError) {
            // Ghost might not be configured, which is fine
            logger.warn('Failed to sync unsubscribe to Ghost', { 
                error: ghostError instanceof Error ? ghostError.message : String(ghostError),
                email: event.identity_value
            });
        }
    }

  } catch (error) {
    logger.error('Failed to process Resend event', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
