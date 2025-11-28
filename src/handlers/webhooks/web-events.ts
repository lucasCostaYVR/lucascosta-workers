// Handler for web events
import { Context } from "hono";
import { WebEventSchema, type WebEvent } from "../../schemas";
import type { Bindings, AppVariables } from "../../types";
import { createLogger } from "../../lib/utils";
import { getOrCreateAnonymousId, resolveIdentity } from "../../lib/utils";
import { buildWebProcessedEvent } from "../../lib/utils";

/**
 * Handles incoming web events from the browser
 * Validates payload, manages anonymous ID cookie, and queues event for processing
 */
export async function handleWebEvent(c: Context<{ Bindings: Bindings, Variables: AppVariables }>): Promise<Response> {
  const logger = createLogger(c.env, c.req.raw);

  try {
    // Parse and validate the incoming payload
    const payload = await c.req.json();
    const webEvent: WebEvent = WebEventSchema.parse(payload);

    // Determine Anonymous ID
    // 1. Prefer ID sent in payload (e.g. from Server Actions or explicit client tracking)
    // 2. Fallback to Cookie (for browser tracking)
    let anonymousId = webEvent.anonymousId;
    
    if (!anonymousId) {
      anonymousId = getOrCreateAnonymousId(c);
    }
    
    // Log consent status
    const hasConsent = c.get('hasConsent');
    
    logger.debug('Anonymous ID resolved', {
      clientSent: webEvent.anonymousId,
      serverAssigned: anonymousId,
      hasConsent
    });

    // Resolve identity (email > user_id > anonymous_id)
    const identity = resolveIdentity(webEvent, anonymousId);

    logger.info('Identity resolved', {
      identity_type: identity.identity_type,
      identity_value: identity.identity_value,
      anonymousId: identity.anonymousId,
      hasConsent,
      webEventUser: webEvent.user,
      webEventProperties: webEvent.properties
    });

    // Build the processed event with consent information
    const processedEvent = buildWebProcessedEvent(webEvent, identity, hasConsent);

    // Queue for async processing
    await c.env.QUEUE.send(processedEvent);

    logger.info('Enqueued web processed event', {
      type: processedEvent.type,
      identity_type: identity.identity_type,
      identity_value: identity.identity_value,
    });

    return c.json({ status: 'OK', anonymousId }, 200);

  } catch (error) {
    logger.error('Error processing web event', { 
      error: error instanceof Error ? error.message : String(error),
    });
    return c.text('Internal Server Error', 500);
  }
}