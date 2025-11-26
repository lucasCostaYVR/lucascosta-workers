import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Bindings } from '../../types'

/**
 * Creates and returns a configured Supabase client instance
 * @param env - Environment bindings containing Supabase credentials
 * @returns Configured Supabase client
 */
export function getSupabaseClient(env: Bindings): SupabaseClient {
  const supabaseUrl = env.SUPABASE_URL
  const supabaseKey = env.SUPABASE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials: SUPABASE_URL and SUPABASE_KEY are required')
  }

  return createClient(supabaseUrl, supabaseKey)
}

// Re-export all database operations for convenience
export * from '../db/profiles';
export * from '../db/subscriptions';
export * from '../db/events';
export * from '../db/identity-graph';
export * from '../db/tags';
