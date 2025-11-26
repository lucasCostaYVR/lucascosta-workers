/**
 * Database operations module
 * 
 * This module provides domain-specific database operations organized by entity type.
 * Each file contains focused operations for a specific domain (profiles, subscriptions, events, identity).
 */

// Re-export all database operations
export * from './profiles';
export * from './subscriptions';
export * from './events';
export * from './identity-graph';
export * from './tags';

// Re-export the database client utility
export { getSupabaseClient } from '../clients/supabase';
