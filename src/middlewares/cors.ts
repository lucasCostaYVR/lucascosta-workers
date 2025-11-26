import { Context } from 'hono';
import type { Bindings } from '../types';
import { createLogger } from '../lib/utils';

/**
 * Allowed origins for public web event ingestion
 * These domains are permitted to send events to /events/ingest
 */
const ALLOWED_ORIGINS = [
  'https://lucascosta.tech',
  'https://www.lucascosta.tech',
  'http://localhost:3000', // Local development
  'http://localhost:5000', // Local development alternative
];

/**
 * Middleware to handle CORS and validate origin
 */
export async function corsMiddleware(
  c: Context<{ Bindings: Bindings }>,
  next: () => Promise<void>
) {
  const logger = createLogger(c.env, c.req.raw);
  const origin = c.req.header('Origin') ?? '';
  
  // Check if origin is allowed
  // We check exact match or if it's a browser request (Origin header present)
  // If no Origin header (server-to-server), we might want to allow or use other auth
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  if (isAllowed) {
    // Set standard CORS headers
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, X-Tracking-Consent');
    c.header('Access-Control-Max-Age', '86400');
  }

  // Handle Preflight
  if (c.req.method === 'OPTIONS') {
    if (!isAllowed) {
      logger.warn('Blocked CORS preflight from disallowed origin', { origin });
      return c.text('Origin not allowed', 403);
    }
    return c.body(null, 204);
  }

  // For non-OPTIONS requests, enforce origin check if Origin header is present
  if (origin && !isAllowed) {
    logger.warn('Blocked request from disallowed origin', { 
      origin,
      allowedOrigins: ALLOWED_ORIGINS,
    });
    return c.text('Origin not allowed', 403);
  }
  
  await next();
}

/**
 * Export allowed origins for use in other modules if needed
 */
export { ALLOWED_ORIGINS };
