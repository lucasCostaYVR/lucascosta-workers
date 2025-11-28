import type { MessageBatch, ExecutionContext } from '@cloudflare/workers-types'
import type { ProcessedEvent } from '../../schemas'
import type { Bindings } from '../../types'
import { createLogger } from '../../lib/utils'
import {
  processGhostSubscriber,
  processNewsletterSubscription,
  processNewsletterUnsubscription,
  processGhostMemberUpdate,
  processWebEvent,
  processResendEvent,
  processContact,
  processComment,
  processPostLike
} from '../processors'
import {
  processSnippetView,
  processSnippetLike,
  processSnippetCopy,
  processSnippetSearch
} from '../processors/snippet-analytics'

/**
 * Main queue consumer handler
 * Routes events to appropriate handlers based on event type
 */
export async function handleQueueConsumer(
  batch: MessageBatch<ProcessedEvent>,
  env: Bindings,
  ctx: ExecutionContext
): Promise<void> {
  const logger = createLogger(env, undefined, ctx);

  logger.info('Processing message batch', {
    queueName: batch.queue,
    messageCount: batch.messages.length,
  });

  for (const msg of batch.messages) {
    try {
      const event = msg.body

      logger.info('Processing event', {
        eventType: event.type,
        source: event.source,
        identityValue: event.identity_value
      })

      // Route to appropriate handler based on event type and source
      if (event.type === 'contact.submitted') {
        // Handle contact form submissions (DB + Email Notification)
        await processContact(event, env);
      }  else if (event.type.startsWith('comment.')) {
        // Handle comment events (create, update, delete)
        await processComment(event, env);
      } else if (event.type === 'post.liked' || event.type === 'post.unliked') {
        // Handle post like/unlike events
        await processPostLike(event, env);
      } else if (event.type === 'snippet.liked' || event.type === 'snippet.unliked') {
        // Handle snippet like/unlike events
        await processSnippetLike(event, env);
      } else if (event.type === 'snippet.copied') {
        // Handle snippet copy events
        await processSnippetCopy(event, env);
      } else if (event.type === 'snippet.searched') {
        // Handle snippet search events (telemetry + Telegram)
        await processSnippetSearch(event, env);
      } else if (event.type === 'snippet.viewed') {
        // Handle snippet view events (telemetry only)
        await processSnippetView(event, env);
      } else if (event.type === 'newsletter.subscribed') {
        // Handle newsletter subscriptions (DB + Resend Sync)
        await processNewsletterSubscription(event, env);
      } else if (event.type === 'newsletter.unsubscribed') {
        // Handle newsletter unsubscriptions
        await processNewsletterUnsubscription(event, env);
      } else if (event.type === 'subscriber.created') {
        // Handle Ghost subscriber creation
        await processGhostSubscriber(event, env);
      } else if (event.type === 'member.edited') {
        // Handle Ghost member edits
        await processGhostMemberUpdate(event, env);
      } else if (event.source === 'resend') {
        // Handle all other Resend events (email.sent, email.opened, etc.)
        await processResendEvent(event, env);
      } else if (event.source === 'web') {
        // Handle all other web events (page.viewed, ui.click, etc.)
        await processWebEvent(event, env);
      } else {
        // Unknown event type
        logger.warn('Unknown event type', {
          eventType: event.type,
          source: event.source,
        });
        // Acknowledge to prevent infinite retries
        msg.ack();
        continue;
      }

      // Mark message as successfully processed
      msg.ack()
      
      logger.info('Event processed successfully', {
        eventType: event.type,
        identityValue: event.identity_value
      })

    } catch (error) {
      logger.error('Failed to process message', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        eventType: msg.body.type
      })
      
      // Retry the message on failure (Cloudflare will retry with exponential backoff)
      msg.retry()
    }
  }

  logger.info('Batch processing complete', {
    messageCount: batch.messages.length
  })
}
