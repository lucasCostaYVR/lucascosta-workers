import type { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { createLogger } from '../lib/utils';
import type { Bindings, AppVariables } from '../types';

/**
 * Middleware to check for tracking consent.
 * Reads consent from:
 * 1. X-Tracking-Consent header (set by client)
 * 2. cookie-consent cookie (fallback for server actions)
 * Sets 'hasConsent' in the context.
 */
export const consentMiddleware = createMiddleware(async (c: Context<{ Bindings: Bindings, Variables: AppVariables }>, next: Next) => {
  const logger = createLogger(c.env, c.req.raw, c.executionCtx);

  // 1. Check X-Tracking-Consent header first
  const consentHeader = c.req.header('X-Tracking-Consent');
  
  // 2. Fallback to cookie-consent cookie (for server actions)
  let consentCookie: string | undefined;
  if (!consentHeader) {
    const cookieHeader = c.req.header('Cookie');
    if (cookieHeader) {
      consentCookie = cookieHeader
        .split(';')
        .map(c => c.trim())
        .find(c => c.startsWith('cookie-consent='))
        ?.split('=')[1];
    }
  }
  
  // Determine consent: granted only if explicitly set to 'granted'
  const consentValue = consentHeader || consentCookie;
  const hasConsent = consentValue === 'granted';

  logger.info('Consent resolved', { 
    hasConsent, 
    header: consentHeader || consentCookie,
    source: consentHeader ? 'header' : (consentCookie ? 'cookie' : 'none')
  });

  // 3. Store in context for other handlers to use
  c.set('hasConsent', hasConsent);

  await next();
});
