import { SupabaseClient } from '@supabase/supabase-js';
import type { ProcessedEvent } from '../../schemas';

export interface ProcessedEventRecord {
  id: string;
  occurred_at: string;
  ingested_at: string;
  source: string;
  type: string;
  identity_type: string;
  identity_value: string;
  traits?: Record<string, unknown>;
  raw?: Record<string, unknown>;
  correlation_id?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Inserts a processed event into the events table
 * 
 * CONSENT MODEL:
 * - WITHOUT consent: Stores event anonymously (identity_value = null) for aggregated analytics
 * - WITH consent: Stores event WITH profile linkage for personalization/journey tracking
 * 
 * This is GDPR-compliant:
 * - Anonymous aggregated data (page views, like counts) = Legitimate business interest
 * - Personal tracking/profiling = Requires explicit consent
 * 
 * @returns The inserted event record, or null if skipped
 */
export async function insertEvent(
  supabase: SupabaseClient,
  event: ProcessedEvent,
  options?: {
    correlation_id?: string;
    meta?: Record<string, unknown>;
    skipConsentCheck?: boolean; // For system events that always need full tracking
  }
): Promise<ProcessedEventRecord | null> {
  const hasConsent = event.traits?.hasConsent as boolean | undefined;
  
  // Determine whether to link to profile
  // WITH consent: store full identity for user journey tracking
  // WITHOUT consent: anonymize (can't stitch back to user, but can aggregate)
  const shouldLinkToProfile = options?.skipConsentCheck || hasConsent;

  const { data, error } = await supabase
    .from('events')
    .insert({
      occurred_at: event.timestamp,
      source: event.source,
      type: event.type,
      // Anonymize if no consent - can't build user profiles/journeys
      identity_type: shouldLinkToProfile ? event.identity_type : null,
      identity_value: shouldLinkToProfile ? event.identity_value : null,
      traits: event.traits || {},
      raw: event.raw || {},
      correlation_id: options?.correlation_id || null,
      meta: options?.meta || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert event: ${error.message}`);
  }

  return data;
}

/**
 * Gets events for a specific identity
 */
export async function getEventsByIdentity(
  supabase: SupabaseClient,
  identityType: string,
  identityValue: string,
  limit: number = 100
): Promise<ProcessedEventRecord[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('identity_type', identityType)
    .eq('identity_value', identityValue)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get events by identity: ${error.message}`);
  }

  return data || [];
}

/**
 * Gets events by type
 */
export async function getEventsByType(
  supabase: SupabaseClient,
  eventType: string,
  limit: number = 100
): Promise<ProcessedEventRecord[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('type', eventType)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get events by type: ${error.message}`);
  }

  return data || [];
}
