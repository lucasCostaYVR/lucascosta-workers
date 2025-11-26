import { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import type { Bindings, AppVariables } from '../../types';
import type { WebEvent, ProcessedEvent } from '../../schemas';

/**
 * Cookie name for anonymous user tracking
 */
export const ANON_COOKIE_NAME = 'lc_anon_id';

/**
 * Cookie max age (1 year in seconds)
 */
export const ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Generates a random anonymous ID
 * Format: anon_{uuid}
 */
export function generateAnonymousId(): string {
  return `anon_${crypto.randomUUID()}`;
}

/**
 * Gets or creates an anonymous ID from cookies
 * The server-side cookie is the source of truth for user identity
 * Respects consent: if no consent, generates transient ID and skips cookie.
 * 
 * @param c - Hono context
 * @returns Anonymous ID (existing or newly generated)
 */
export function getOrCreateAnonymousId(c: Context<{ Bindings: Bindings, Variables: AppVariables }>): string {
  // Check consent status (set by middleware)
  const hasConsent = c.get('hasConsent');

  // 1. If consent is NOT granted, return a transient ID and do NOT touch cookies
  if (hasConsent !== true) {
    return generateAnonymousId(); // One-time ID, lost on refresh
  }

  // 2. If consent is GRANTED, try to get existing cookie
  const existingId = getCookie(c, ANON_COOKIE_NAME);
  
  if (existingId) {
    return existingId;
  }
  
  // 3. Generate new ID and set cookie
  const newId = generateAnonymousId();
  
  // Set cookie with secure settings
  setCookie(c, ANON_COOKIE_NAME, newId, {
    maxAge: ANON_COOKIE_MAX_AGE,
    httpOnly: true,
    secure: c.env.RUNTIME_ENV === 'prod',
    sameSite: 'Lax',
    path: '/',
  });
  
  return newId;
}

/**
 * Identity information extracted from a web event
 */
export interface ResolvedIdentity {
  identity_type: ProcessedEvent['identity_type'];
  identity_value: string;
  anonymousId: string;
}

/**
 * Resolves identity from a web event
 * Priority: email > user_id > anonymous_id
 * 
 * @param webEvent - The incoming web event
 * @param anonymousId - The server-assigned anonymous ID
 * @returns Resolved identity information
 */
export function resolveIdentity(webEvent: WebEvent, anonymousId: string): ResolvedIdentity {
  // Check for authenticated user (email has highest priority)
  if (webEvent.user?.email) {
    return {
      identity_type: 'email',
      identity_value: webEvent.user.email,
      anonymousId,
    };
  }
  
  // Check for user ID
  if (webEvent.user?.id) {
    return {
      identity_type: 'user_id',
      identity_value: webEvent.user.id,
      anonymousId,
    };
  }
  
  // Default to anonymous ID
  return {
    identity_type: 'anonymous_id',
    identity_value: anonymousId,
    anonymousId,
  };
}
