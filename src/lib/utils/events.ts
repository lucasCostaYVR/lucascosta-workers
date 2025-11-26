import type { WebEvent, ProcessedEvent } from '../../schemas';
import type { ResolvedIdentity } from './identity';

/**
 * Builds a ProcessedEvent from a WebEvent
 * 
 * @param webEvent - The incoming web event payload
 * @param identity - The resolved identity information
 * @returns A properly formatted ProcessedEvent ready for queueing
 */
export function buildWebProcessedEvent(
  webEvent: WebEvent,
  identity: ResolvedIdentity
): ProcessedEvent {
  // Use provided timestamp or default to now
  const occurredAt = webEvent.timestamp 
    ? new Date(webEvent.timestamp).toISOString() 
    : new Date().toISOString();

  return {
    source: 'web',
    type: webEvent.name, // Use the event name directly (domain.action)
    identity_type: identity.identity_type,
    identity_value: identity.identity_value,
    traits: {
      // Keep structure clean (Segment Style)
      context: {
        ...webEvent.context,
        // Ensure anonymousId is in context for debugging
        anonymousId: identity.anonymousId,
      },
      properties: webEvent.properties || {},
      user: webEvent.user || {},
      
      // Legacy Flattening (Keep for backward compatibility with existing views)
      // Spread order matters! Later spreads override earlier ones.
      ...webEvent.context,
      ...webEvent.properties,
      ...webEvent.user,  // User fields should override everything else
      anonymousId: identity.anonymousId,
    },
    timestamp: occurredAt,
    raw: webEvent,
  };
}
