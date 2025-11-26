import { Hono } from 'hono'
import type { MessageBatch, ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types'
import { handleGhostWebhook, handleResend, handleWebEvent, handleNotionWebhook } from './handlers/webhooks'
import { handleQueueConsumer, handleDLQConsumer } from './handlers/queue'
import { processCmsSync, sendDailySummary } from './handlers/processors'
import { Bindings, AppVariables } from './types'
import { validateWebhookKey } from './middlewares/webhooks'
import { corsMiddleware } from './middlewares/cors'
import { consentMiddleware } from './middlewares/consent'
import type { ProcessedEvent } from './schemas'
import { handleServePixel } from './handlers/serve-pixel'




const app = new Hono<{ Bindings: Bindings, Variables: AppVariables }>()

// 1. SECURITY MIDDLEWARE (Keep this to prevent spam)
app.use('/webhooks/*', validateWebhookKey)

/**
 * 2. GHOST EVENT QUEUER
 */
app.post('/webhooks/ghost', handleGhostWebhook)

/**
 * 3. RESEND LOGGER (Raw Inspection)
 */
app.post('/webhooks/resend', handleResend)

/**
 * 4. NOTION WEBHOOK HANDLER
 */
app.post('/webhooks/notion', handleNotionWebhook)

/**
 * 5. WEB EVENT HANDLER (Public - Browser)
 * Public endpoint for client-side tracking.
 * Handles CORS and Consent.
 */
app.use('/events/track', corsMiddleware)
app.post('/events/track', consentMiddleware, handleWebEvent)

/**
 * 6. SERVER EVENT INGESTION (Secured - Server Actions)
 * Secured endpoint for server-side event ingestion.
 * Requires x-webhook-secret header.
 */
app.use('/events/ingest', validateWebhookKey)
app.post('/events/ingest', handleWebEvent)

/**
 * 7. SERVE PIXEL SCRIPT
 */
app.get('/pixel.js', handleServePixel)

export default {
  fetch: app.fetch,
  
  // Main queue consumer
  async queue(
    batch: MessageBatch<any>,
    env: Bindings,
    ctx: ExecutionContext
  ) {
    // Route to appropriate queue handler based on queue name
    const queueName = batch.queue;
    
    if (queueName === 'event-ingestion-queue') {
      return handleQueueConsumer(batch as MessageBatch<ProcessedEvent>, env, ctx);
    } else if (queueName === 'event-ingestion-dlq') {
      return handleDLQConsumer(batch as MessageBatch<ProcessedEvent>, env, ctx);
    } else if (queueName === 'cms-sync-queue') {
      // Process each message in the batch
      for (const message of batch.messages) {
        await processCmsSync(message, env);
      }
    } else {
      console.error(`Unknown queue: ${queueName}`);
    }
  },

  // Scheduled handler (cron triggers)
  async scheduled(
    event: ScheduledEvent,
    env: Bindings,
    ctx: ExecutionContext
  ) {
    const now = new Date();
    const isSunday = now.getUTCDay() === 0;
    const isNearMidnight = now.getUTCHours() === 23 && now.getUTCMinutes() === 55;
    const is8PM = now.getUTCHours() === 20 && now.getUTCMinutes() === 0;

    if (is8PM) {
      // Daily 8 PM UTC - Send daily summary
      console.log('[CRON] Sending daily summary');
      await sendDailySummary(env);
    } else if (isNearMidnight && isSunday) {
      // Sunday 11:55 PM - Create weekly snapshot (queries both rows, creates snapshot)
      console.log('[CRON] Creating weekly snapshot');
      await env.CMS_QUEUE.send({
        action: 'export',
        sourceKey: 'WEEKLY_PULSE',
      });
    } else {
      // Every 15 min - Update all dashboard exports (no notifications)
      console.log('[CRON] Updating dashboard exports');
      
      // 1. Update "Last 7 Days" rolling window (first row only)
      await env.CMS_QUEUE.send({
        action: 'export',
        sourceKey: 'WEEKLY_PULSE',
        batchSize: 1, // Only process first row ("Last 7 Days")
      });
      
      // 2. Update traffic sources
      await env.CMS_QUEUE.send({
        action: 'export',
        sourceKey: 'TRAFFIC_SOURCES',
      });
      
      // 3. Update blog analytics (only posts with activity)
      await env.CMS_QUEUE.send({
        action: 'export',
        sourceKey: 'BLOG_ANALYTICS',
      });
    }
  },
}