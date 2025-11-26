import { GhostMemberSchema } from "../../../schemas";
import type { WebhookContext } from "../../../types";
import { handleSubscriberCreated } from "./subscriber-created";
import { handleMemberEdited } from "./member-edited";
import { createLogger } from "../../../lib/utils";
/**
 * Ghost webhook event types that we support
 */
type GhostEventType = 'member.added' | 'member.edited' | 'member.deleted';

/**
 * Main Ghost webhook handler
 * Routes incoming webhooks to the appropriate event-specific handler
 */
export async function handleGhostWebhook(c: WebhookContext): Promise<Response> {
    const logger = createLogger(c.env, c.req.raw);
  try {
    const payload = await c.req.json();
    const parsed = GhostMemberSchema.safeParse(payload);

    if (!parsed.success) {
      logger.error('Failed to parse Ghost webhook payload', {
        error: parsed.error,
      });
      return c.text('Invalid payload structure', 400);
    }

    const member = parsed.data.member.current;

    logger.info('Received Ghost webhook for member', {
      memberId: member.id,
      email: member.email,
      status: member.status // status indicates if free or paid
    });

    // Determine the event type from the webhook
    const eventType = determineEventType(c, parsed.data);
    
    logger.info('Determined Ghost event type', { eventType });

    // Route to the appropriate handler based on event type
    let processedEvent;
    
    switch (eventType) {
      case 'member.added':
        processedEvent = await handleSubscriberCreated(parsed.data);
        logger.info('Created processed event for new subscriber', { 
          email: member.email,
          processed_event: processedEvent
        });
        break;
      
      case 'member.edited':
        processedEvent = await handleMemberEdited(parsed.data);
        logger.info('Created processed event for member edit', { 
          email: member.email,
          processed_event: processedEvent
        });
        break;
      
      case 'member.deleted':
        // TODO: Implement member deletion handler
        logger.warn('Member deleted event received but not yet implemented', {
          email: member.email,
          event: {}
        });
        return c.text('Ghost webhook processed (deletion not implemented)', 200);
      
      default:
        logger.warn('Unknown Ghost event type', { eventType });
        return c.text('Unknown event type', 400);
    }

    // Queue the processed event to QUEUE binding
    await c.env.QUEUE.send(processedEvent);
    
    logger.info('Successfully queued processed event', {
      eventType: processedEvent.type,
      email: processedEvent.identity_value
    });

    return c.text('Ghost webhook processed successfully', 200);
  } catch (error) {
    logger.error('Error processing Ghost webhook', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return c.text('Internal server error', 500);
  }
}

/**
 * Determines the Ghost event type from the webhook
 * This is a helper function since Ghost may send event type in headers or you may infer it
 */
function determineEventType(c: WebhookContext, validData: any): GhostEventType {
  // Option 1: Check if Ghost sends event type in headers
  const eventHeader = c.req.header('X-Ghost-Event');
  if (eventHeader) {
    return eventHeader as GhostEventType;
  }

  // Option 2: Infer from the payload
  // If member.previous is empty/null, it's likely a new member
  const previous = validData.member.previous;
  const current = validData.member.current;

  // Check if this looks like a new member (you may need to adjust this logic)
  if (!previous.last_seen_at && current.created_at === current.updated_at) {
    return 'member.added';
  }

  // Otherwise assume it's an edit
  return 'member.edited';
}
