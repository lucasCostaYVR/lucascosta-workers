import { Context } from 'hono'
import { ProcessedEvent } from './schemas'
import type { KVNamespace } from '@cloudflare/workers-types'

export type CfQueue<T = unknown> = {
  send: (message: T) => Promise<void>;
  sendBatch?: (messages: T[]) => Promise<void>;
};

export type Bindings = {
  WEBHOOK_SECRET: string,
  QUEUE: CfQueue<ProcessedEvent>,
  DLQ: CfQueue<ProcessedEvent>,  // Dead Letter Queue
  CMS_QUEUE: CfQueue<any>, // Using any for now, or CmsSyncJob
  SUPABASE_URL: string,
  SUPABASE_KEY: string,
  SENTRY_DSN?: string,  // Sentry Data Source Name
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  RUNTIME_ENV?: 'dev' | 'staging' | 'prod';
  RESEND_API_KEY?: string;
  RESEND_AUDIENCE_ID?: string;
  GHOST_ADMIN_API_KEY?: string;
  GHOST_API_URL?: string;
  NOTION_API_KEY: string;
  NOTION_DATABASE_ID: string;
  ASSETS_BUCKET: R2Bucket;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  SITE_SETTINGS: KVNamespace;
  ADMIN_SECRET: string;
  AIRTABLE_API_KEY: string;
  AIRTABLE_BASE_ID: string;
  AIRTABLE_BANNERS_TABLE_ID: string;
}

export type AppVariables = {
  hasConsent: boolean;
}

// Use Hono's built-in Context type instead of manually defining it
export type WebhookContext = Context<{ Bindings: Bindings, Variables: AppVariables }>