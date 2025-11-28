import { Hono } from 'hono'
import type { MessageBatch, ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types'
import { handleGhostWebhook, handleResend, handleWebEvent, handleNotionWebhook } from './handlers/webhooks'
import { handleQueueConsumer, handleDLQConsumer } from './handlers/queue'
import { processCmsSync } from './handlers/processors'
import { executeCronJob } from './handlers/scheduled'
import { Bindings, AppVariables } from './types'
import { validateWebhookKey } from './middlewares/webhooks'
import { corsMiddleware } from './middlewares/cors'
import { consentMiddleware } from './middlewares/consent'
import type { ProcessedEvent } from './schemas'
import { handleServePixel } from './handlers/serve-pixel'
import bannerRoutes from './handlers/webhooks/banner'
import airtableWebhook from './handlers/webhooks/airtable'




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
 * 4b. AIRTABLE WEBHOOK HANDLER (Syncs Airtable → KV)
 */
app.route('/webhooks/airtable', airtableWebhook)

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

/**
 * 8. SITE BANNER API (Public GET, Protected POST/DELETE)
 */
app.use('/api/banner', corsMiddleware)
app.route('/api/banner', bannerRoutes)

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
    await executeCronJob(event, env);
  },
}