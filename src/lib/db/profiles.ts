import { SupabaseClient } from '@supabase/supabase-js';
import type { ProcessedEvent } from '../../schemas';

export interface ProfileData {
  id: string;
  email: string;
  name?: string | null;
  status?: string | null;
}

/**
 * Upserts a profile based on event data
 * @returns The profile ID
 */
export async function upsertProfileFromEvent(
  supabase: SupabaseClient,
  event: ProcessedEvent
): Promise<ProfileData> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        email: event.identity_value,
        name: event.traits?.name || null,
        status: event.traits?.status || 'free',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'email',
      }
    )
    .select('id, email, name, status')
    .single();

  if (error) {
    throw new Error(`Failed to upsert profile: ${error.message}`);
  }

  return data;
}

/**
 * Gets a profile by email
 */
export async function getProfileByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<ProfileData | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, status')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get profile: ${error.message}`);
  }

  return data;
}
