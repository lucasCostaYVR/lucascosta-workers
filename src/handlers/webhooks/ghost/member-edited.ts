import type { ProcessedEvent } from "../../../schemas";
import { z } from "zod";

/**
 * Handles Ghost member.edited webhook events
 * Detects newsletter subscription changes (opt-in/opt-out) and profile updates
 */
export async function handleMemberEdited(
  validatedData: z.infer<typeof import("../../../schemas").GhostMemberSchema>
): Promise<ProcessedEvent> {
  const current = validatedData.member.current;
  const previous = validatedData.member.previous;

  // Detect newsletter subscription changes
  const currentNewsletters = current.newsletters || [];
  const previousNewsletters = previous.newsletters || [];
  
  const wasSubscribed = previousNewsletters.length > 0;
  const isSubscribed = currentNewsletters.length > 0;
  
  // Determine the event type based on newsletter changes
  let eventType = 'member.edited';
  let subscriptionStatus = isSubscribed;
  
  if (!wasSubscribed && isSubscribed) {
    // Opted IN - went from 0 newsletters to 1+ newsletters
    eventType = 'newsletter.subscribed';
  } else if (wasSubscribed && !isSubscribed) {
    // Opted OUT - went from 1+ newsletters to 0 newsletters
    eventType = 'newsletter.unsubscribed';
  }

  const processedEvent: ProcessedEvent = {
    source: 'ghost',
    type: eventType,
    identity_value: current.email,
    identity_type: 'email',
    traits: {
      email: current.email,
      name: current.name,
      status: current.status,
    },
    timestamp: new Date().toISOString(),
    raw: validatedData,
  };

  return processedEvent;
}
