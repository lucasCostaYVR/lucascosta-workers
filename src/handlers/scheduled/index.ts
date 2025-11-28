/**
 * Scheduled Jobs (Cron) Registry
 * 
 * Centralized management of all cron jobs.
 * Each job has a name, schedule, and handler function.
 */

import type { ScheduledEvent } from '@cloudflare/workers-types';
import type { Bindings } from '../../types';
import { sendDailySummary } from '../processors';
import { createLogger } from '../../lib/utils';

export interface CronJob {
  name: string;
  description: string;
  schedule: string; // Cron expression
  handler: (env: Bindings) => Promise<void>;
}

/**
 * All registered cron jobs
 */
export const CRON_JOBS: CronJob[] = [
  {
    name: 'daily-summary',
    description: 'Send daily analytics summary via Telegram',
    schedule: '0 20 * * *', // 8 PM UTC daily
    handler: async (env) => {
      await sendDailySummary(env);
    },
  },
  
  {
    name: 'dashboard-updates',
    description: 'Update Notion dashboard exports (rolling metrics)',
    schedule: '*/15 * * * *', // Every 15 minutes
    handler: async (env) => {
      // Update "Last 7 Days" rolling window (first row only)
      await env.CMS_QUEUE.send({
        action: 'export',
        sourceKey: 'WEEKLY_PULSE',
        batchSize: 1, // Only process first row
      });
      
      // Update traffic sources
      await env.CMS_QUEUE.send({
        action: 'export',
        sourceKey: 'TRAFFIC_SOURCES',
      });
      
      // Update blog analytics (only posts with activity)
      await env.CMS_QUEUE.send({
        action: 'export',
        sourceKey: 'BLOG_ANALYTICS',
      });
    },
  },
  
  {
    name: 'weekly-snapshot',
    description: 'Create weekly snapshot (full data export)',
    schedule: '55 23 * * SUN', // Sunday 11:55 PM UTC
    handler: async (env) => {
      await env.CMS_QUEUE.send({
        action: 'export',
        sourceKey: 'WEEKLY_PULSE',
      });
    },
  },
  
  {
    name: 'airtable-webhook-refresh',
    description: 'Refresh Airtable webhooks to prevent 7-day expiration',
    schedule: '0 0 */6 * *', // Every 6 days at midnight UTC
    handler: async (env) => {
      const logger = createLogger(env);
      
      try {
        // List existing webhooks
        const listResponse = await fetch(
          `https://api.airtable.com/v0/bases/${env.AIRTABLE_BASE_ID}/webhooks`,
          {
            headers: {
              'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
            },
          }
        );
        
        if (!listResponse.ok) {
          throw new Error(`Failed to list webhooks: ${listResponse.statusText}`);
        }
        
        const { webhooks } = await listResponse.json() as { webhooks: any[] };
        
        // Refresh each webhook
        for (const webhook of webhooks) {
          const refreshResponse = await fetch(
            `https://api.airtable.com/v0/bases/${env.AIRTABLE_BASE_ID}/webhooks/${webhook.id}/refresh`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
              },
            }
          );
          
          if (refreshResponse.ok) {
            const data = await refreshResponse.json() as { expirationTime?: string };
            logger.info('Airtable webhook refreshed', {
              webhookId: webhook.id,
              newExpiration: data.expirationTime,
            });
          } else {
            logger.error('Failed to refresh webhook', {
              webhookId: webhook.id,
              error: await refreshResponse.text(),
            });
          }
        }
      } catch (error) {
        logger.error('Airtable webhook refresh failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  },
];

/**
 * Execute the appropriate cron job based on schedule match
 */
export async function executeCronJob(
  event: ScheduledEvent,
  env: Bindings
): Promise<void> {
  const logger = createLogger(env);
  const now = new Date();
  
  // Simple time-based matching (could be improved with cron parser)
  const currentMinute = now.getUTCMinutes();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay();
  
  for (const job of CRON_JOBS) {
    let shouldRun = false;
    
    // Match cron schedule to current time
    if (job.schedule === '0 20 * * *' && currentHour === 20 && currentMinute === 0) {
      shouldRun = true; // Daily at 8 PM
    } else if (job.schedule === '*/15 * * * *' && currentMinute % 15 === 0) {
      shouldRun = true; // Every 15 minutes
    } else if (job.schedule === '55 23 * * SUN' && currentDay === 0 && currentHour === 23 && currentMinute === 55) {
      shouldRun = true; // Sunday 11:55 PM
    } else if (job.schedule === '0 0 */6 * *' && currentHour === 0 && currentMinute === 0 && now.getUTCDate() % 6 === 0) {
      shouldRun = true; // Every 6 days at midnight
    }
    
    if (shouldRun) {
      logger.info(`[CRON] Running job: ${job.name}`, { description: job.description });
      
      try {
        await job.handler(env);
        logger.info(`[CRON] Job completed: ${job.name}`);
      } catch (error) {
        logger.error(`[CRON] Job failed: ${job.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
