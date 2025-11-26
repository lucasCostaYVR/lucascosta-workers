import type { Context, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { createLogger } from '../lib/utils';
import type { Bindings, AppVariables } from '../types';

/**
 * Middleware to check for tracking consent.
 * Reads the 'X-Tracking-Consent' header.
 * Sets 'hasConsent' in the context.
 */
export const consentMiddleware = createMiddleware(async (c: Context<{ Bindings: Bindings, Variables: AppVariables }>, next: Next) => {
  const logger = createLogger(c.env, c.req.raw, c.executionCtx);

  // 1. Check header (default to 'granted' for this Toy CDP to ensure tracking works)
  // In a real GDPR-compliant app, you might default to 'denied'.
  const consentHeader = c.req.header('X-Tracking-Consent');
  
  // Opt-out model: We track unless explicitly denied.
  const hasConsent = consentHeader !== 'denied';

  logger.info('Consent resolved', { hasConsent, header: consentHeader });

  // 2. Store in context for other handlers to use
  c.set('hasConsent', hasConsent);

  await next();
});
