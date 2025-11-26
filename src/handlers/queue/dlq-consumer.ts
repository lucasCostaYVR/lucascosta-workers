import type { MessageBatch, ExecutionContext } from '@cloudflare/workers-types'
import type { ProcessedEvent } from '../../schemas'
import type { Bindings } from '../../types'

/**
 * Dead Letter Queue (DLQ) Consumer
 * Handles messages that failed processing after max retries
 * 
 * This handler should:
 * 1. Log the failed message for investigation
 * 2. Optionally store in a database for manual review
 * 3. Alert/notify on-call engineers
 * 4. Collect metrics on failure patterns
 */
export async function handleDLQConsumer(
  batch: MessageBatch<ProcessedEvent>,
  env: Bindings,
  ctx: ExecutionContext
): Promise<void> {
  for (const msg of batch.messages) {
    const event = msg.body;

    console.error('================ DLQ Message Received ================')
    console.error('Failed Event Source:', event.source)
    console.error('Failed Event Type:', event.type)
    console.error('Failed Event Identity:', event.identity_value)
    console.error('Failed Event Timestamp:', event.timestamp)
    console.error('Full Event Data:', JSON.stringify(event, null, 2))
    console.error('====================================================')

    // TODO: Implement one or more of these strategies:
    
    // Option 1: Store in a database for manual review
    // const supabase = getSupabaseClient(env);
    // await supabase.from('failed_events').insert({
    //   event_data: event,
    //   failed_at: new Date().toISOString(),
    //   retry_count: msg.attempts || 0,
    // });

    // Option 2: Send alert (email, Slack, PagerDuty, etc.)
    // await sendAlert(env, `DLQ: Failed to process ${event.type} event`);

    // Option 3: Send to external logging service
    // await logToDatadog(event);

    // Option 4: Store in R2 for later analysis
    // await env.FAILED_EVENTS_BUCKET.put(
    //   `failed/${Date.now()}-${event.identity_value}.json`,
    //   JSON.stringify(event)
    // );

    // Always acknowledge DLQ messages (don't retry again)
    msg.ack();
  }
}
