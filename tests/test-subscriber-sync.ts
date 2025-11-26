import { processGhostSubscriber } from '../src/handlers/processors/subscriber-created';
import type { ProcessedEvent } from '../src/schemas';
import type { Bindings } from '../src/types';

// Mock environment
const env: Bindings = {
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_KEY: process.env.SUPABASE_KEY || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_AUDIENCE_ID: process.env.RESEND_AUDIENCE_ID || '',
  WEBHOOK_SECRET: 'test',
  QUEUE: { send: async () => {} },
  DLQ: { send: async () => {} },
  CMS_QUEUE: { send: async () => {} },
  NOTION_API_KEY: '',
  NOTION_DATABASE_ID: '',
  ASSETS_BUCKET: {} as any,
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: ''
};

async function testSubscriberSync() {
  console.log('🧪 Starting Subscriber Sync Test...\n');

  if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
    console.error('❌ Missing RESEND_API_KEY or RESEND_AUDIENCE_ID in environment');
    process.exit(1);
  }

  const testEmail = `test.sync.${Date.now()}@example.com`;
  
  const event: ProcessedEvent = {
    source: 'ghost',
    type: 'subscriber.created',
    identity_type: 'email',
    identity_value: testEmail,
    timestamp: new Date().toISOString(),
    traits: {
      email: testEmail,
      name: 'Test Subscriber',
      status: 'free'
    },
    raw: {}
  };

  console.log(`Processing subscriber.created for ${testEmail}...`);

  try {
    await processGhostSubscriber(event, env);
    console.log('\n✅ Subscriber processed successfully.');
    console.log('   Check Resend Audience to verify contact was added with profile_id.');
  } catch (error) {
    console.error('\n❌ Failed to process subscriber:', error);
    process.exit(1);
  }
}

// Load .dev.vars into process.env for local testing
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
if (fs.existsSync(devVarsPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(devVarsPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
    // Update the env object
    if (k === 'SUPABASE_URL') env.SUPABASE_URL = envConfig[k];
    if (k === 'SUPABASE_KEY') env.SUPABASE_KEY = envConfig[k];
    if (k === 'RESEND_API_KEY') env.RESEND_API_KEY = envConfig[k];
    if (k === 'RESEND_AUDIENCE_ID') env.RESEND_AUDIENCE_ID = envConfig[k];
  }
}

testSubscriberSync().catch(console.error);
