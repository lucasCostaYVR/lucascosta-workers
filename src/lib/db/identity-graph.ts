import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Result from merging anonymous identity with email
 */
export interface MergeResult {
  profile_id: string;
  was_new_profile: boolean;
  was_merged: boolean;
}

/**
 * Identity information
 */
export interface Identity {
  identity_type: string;
  identity_value: string;
  first_seen_at: string;
  last_seen_at: string;
}

/**
 * Gets or creates a profile for an anonymous ID
 * Creates a new profile with email=NULL if anonymous ID not found
 * 
 * @param supabase - Supabase client
 * @param anonymousId - The anonymous ID (e.g., 'anon_abc123')
 * @returns Profile ID (UUID)
 */
export async function getOrCreateProfileByAnonymousId(
  supabase: SupabaseClient,
  anonymousId: string
): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_profile_by_anonymous_id', {
    p_anonymous_id: anonymousId,
  });

  if (error) {
    throw new Error(`Failed to get/create anonymous profile: ${error.message}`);
  }

  return data;
}

/**
 * Merges an anonymous profile with an email profile
 * Handles all scenarios atomically in the database:
 * - Anonymous user subscribes → upgrades anonymous profile with email
 * - Email user gets new anonymous ID → links to existing email profile
 * - Two separate profiles exist → merges them
 * 
 * @param supabase - Supabase client
 * @param email - User's email address
 * @param anonymousId - Anonymous ID from cookie
 * @param metadata - Optional profile metadata (name, status)
 * @returns Merge result with profile_id and merge status
 */
export async function mergeAnonymousToEmail(
  supabase: SupabaseClient,
  email: string,
  anonymousId: string,
  metadata?: { name?: string; status?: string }
): Promise<MergeResult> {
  const { data, error } = await supabase.rpc('merge_anonymous_to_email', {
    p_email: email,
    p_anonymous_id: anonymousId,
    p_name: metadata?.name || null,
    p_status: metadata?.status || null,
  });

  if (error) {
    throw new Error(`Failed to merge identities: ${error.message}`);
  }

  // PostgreSQL function returns array with single result
  return data[0];
}

/**
 * Gets profile ID by any identity type/value
 * Updates last_seen timestamp if found
 * 
 * @param supabase - Supabase client
 * @param identityType - Type of identity ('email', 'anonymous_id', 'user_id')
 * @param identityValue - The identity value
 * @returns Profile ID or null if not found
 */
export async function getProfileByIdentity(
  supabase: SupabaseClient,
  identityType: string,
  identityValue: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_profile_by_identity', {
    p_identity_type: identityType,
    p_identity_value: identityValue,
  });

  if (error) {
    throw new Error(`Failed to get profile by identity: ${error.message}`);
  }

  return data;
}

/**
 * Gets all identities linked to a profile
 * Useful for debugging and analytics (seeing user's journey)
 * 
 * @param supabase - Supabase client
 * @param profileId - Profile UUID
 * @returns Array of identities linked to this profile
 */
export async function getIdentitiesForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<Identity[]> {
  const { data, error } = await supabase.rpc('get_identities_for_profile', {
    p_profile_id: profileId,
  });

  if (error) {
    throw new Error(`Failed to get identities for profile: ${error.message}`);
  }

  return data || [];
}

/**
 * Links an anonymous ID to a known profile ID
 * Used when a user clicks a magic link with ?uid=...
 * 
 * @param supabase - Supabase client
 * @param profileId - The known profile UUID from the magic link
 * @param anonymousId - The current session's anonymous ID
 */
export async function linkAnonymousToProfileId(
  supabase: SupabaseClient,
  profileId: string,
  anonymousId: string
): Promise<void> {
  // We use upsert to handle the case where this link already exists
  // The unique constraint on (identity_type, identity_value) handles conflicts
  const { error } = await supabase
    .from('identity_graph')
    .upsert({
      profile_id: profileId,
      identity_type: 'anonymous_id',
      identity_value: anonymousId,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'identity_type, identity_value'
    });

  if (error) {
    throw new Error(`Failed to link anonymous ID to profile: ${error.message}`);
  }
}
