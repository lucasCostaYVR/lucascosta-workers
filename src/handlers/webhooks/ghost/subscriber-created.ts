import type { ProcessedEvent } from "../../../schemas";
import { z } from "zod";

/**
 * Handles Ghost subscriber.created webhook events
 * Processes new member signups and converts them to ProcessedEvents
 */
export async function handleSubscriberCreated(
  validatedData: z.infer<typeof import("../../../schemas").GhostMemberSchema>
): Promise<ProcessedEvent> {
  const { current } = validatedData.member;

  const processedEvent: ProcessedEvent = {
    source: 'ghost',
    type: 'subscriber.created',
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

  console.log('Created processed event for new subscriber:', current.email);
  return processedEvent;
}
