#!/usr/bin/env node

/**
 * Airtable Webhook Setup Script
 * Creates a webhook to sync Site Banners table changes to Workers
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appZNXVXQoH5pnZlO';
// Webhooks require the table ID, not the table name
const TABLE_ID = 'tblJh2rV1l5h7qc3Z'; // Site Banners table
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://api.lucascosta.tech/webhooks/airtable';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'G1R1GEwAH70gkkOsHxZza02o5rZBcBXJ';

if (!AIRTABLE_API_KEY) {
  console.error('❌ AIRTABLE_API_KEY not found in environment');
  process.exit(1);
}

async function createWebhook() {
  console.log('\n🔧 Creating Airtable webhook...\n');
  console.log(`Base ID: ${BASE_ID}`);
  console.log(`Table ID: ${TABLE_ID}`);
  console.log(`Webhook URL: ${WEBHOOK_URL}/webhooks/airtable?key=${WEBHOOK_SECRET.substring(0, 10)}...`);
  
  const response = await fetch(`https://api.airtable.com/v0/bases/${BASE_ID}/webhooks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      notificationUrl: `${WEBHOOK_URL}/webhooks/airtable?key=${WEBHOOK_SECRET}`,
      specification: {
        options: {
          filters: {
            dataTypes: ['tableData'],
            recordChangeScope: TABLE_ID, // Only watch Site Banners table
          }
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Failed to create webhook:', error);
    process.exit(1);
  }

  const data = await response.json();
  
  console.log('\n✅ Webhook created successfully!\n');
  console.log(`Webhook ID: ${data.id}`);
  console.log(`MAC Secret: ${data.macSecretBase64}`);
  console.log(`Expiration: ${data.expirationTime || 'Never (if using User API key)'}`);
  
  console.log('\n⚠️  Important: Store the MAC secret securely!');
  console.log('You can use it to verify webhook authenticity (optional).\n');
  console.log('Add to your .dev.vars:');
  console.log(`AIRTABLE_WEBHOOK_MAC_SECRET="${data.macSecretBase64}"`);
  console.log('\nAnd to production secrets:');
  console.log(`npx wrangler secret put AIRTABLE_WEBHOOK_MAC_SECRET`);
  
  console.log('\n📝 Note: Webhooks expire after 7 days.');
  console.log('To keep it alive, we need to refresh it or fetch payloads regularly.');
  console.log('Consider adding a cron job to refresh every 6 days.\n');
}

async function listWebhooks() {
  console.log('\n📋 Existing webhooks:\n');
  
  const response = await fetch(`https://api.airtable.com/v0/bases/${BASE_ID}/webhooks`, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Failed to list webhooks:', error);
    return;
  }

  const data = await response.json();
  
  if (data.webhooks.length === 0) {
    console.log('No webhooks found.\n');
    return;
  }
  
  data.webhooks.forEach((webhook, i) => {
    console.log(`${i + 1}. ${webhook.id}`);
    console.log(`   URL: ${webhook.notificationUrl}`);
    console.log(`   Are Notifications Enabled: ${webhook.areNotificationsEnabled}`);
    console.log(`   Expiration: ${webhook.expirationTime || 'Never'}`);
    console.log();
  });
}

// Main
const command = process.argv[2];

if (command === 'list') {
  listWebhooks().catch(console.error);
} else if (command === 'create') {
  createWebhook().catch(console.error);
} else {
  console.log('\nUsage:');
  console.log('  node scripts/setup-airtable-webhook.js list    - List existing webhooks');
  console.log('  node scripts/setup-airtable-webhook.js create  - Create new webhook\n');
}
