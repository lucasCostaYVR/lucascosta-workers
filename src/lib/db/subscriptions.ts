import { SupabaseClient } from '@supabase/supabase-js';
import type { ProcessedEvent } from '../../schemas';

export interface EmailSubscription {
  id: string;
  profile_id: string;
  source: string;
  subscribed: boolean;
  subscribed_at?: string | null;
  unsubscribed_at?: string | null;
}

/**
 * Activates an email subscription (subscribe or resubscribe)
 */
export async function activateEmailSubscription(
  supabase: SupabaseClient,
  profileId: string,
  event: ProcessedEvent
): Promise<void> {
  const { error } = await supabase
    .from('email_subscriptions')
    .upsert(
      {
        profile_id: profileId,
        source: event.source,
        subscribed: true,
        subscribed_at: event.timestamp,
        unsubscribed_at: null,
      },
      {
        onConflict: 'profile_id',
      }
    );

  if (error) {
    throw new Error(`Failed to activate email subscription: ${error.message}`);
  }
}

/**
 * Deactivates an email subscription (unsubscribe)
 */
export async function deactivateEmailSubscription(
  supabase: SupabaseClient,
  profileId: string,
  event: ProcessedEvent
): Promise<void> {
  const { error } = await supabase
    .from('email_subscriptions')
    .upsert(
      {
        profile_id: profileId,
        source: event.source,
        subscribed: false,
        subscribed_at: null,
        unsubscribed_at: event.timestamp,
      },
      {
        onConflict: 'profile_id',
      }
    );

  if (error) {
    throw new Error(`Failed to deactivate email subscription: ${error.message}`);
  }
}

/**
 * Gets email subscription status for a profile
 */
export async function getEmailSubscription(
  supabase: SupabaseClient,
  profileId: string
): Promise<EmailSubscription | null> {
  const { data, error } = await supabase
    .from('email_subscriptions')
    .select('*')
    .eq('profile_id', profileId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get email subscription: ${error.message}`);
  }

  return data;
}
