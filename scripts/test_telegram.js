import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .dev.vars
const devVarsPath = path.join(__dirname, '../.dev.vars');
const env = {};

if (fs.existsSync(devVarsPath)) {
  const content = fs.readFileSync(devVarsPath, 'utf-8');
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)="(.*)"$/) || line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^"(.*)"$/, '$1');
      env[key] = value;
    }
  });
}

async function testTelegram() {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .dev.vars');
    process.exit(1);
  }

  if (!chatId) {
    console.error('❌ TELEGRAM_CHAT_ID not found in .dev.vars');
    console.log('\n💡 Run this first to get your chat ID:');
    console.log('   node scripts/get_telegram_chat_id.js\n');
    process.exit(1);
  }

  console.log('🤖 Testing Telegram notifications...\n');

  // Test 1: Simple message
  console.log('1️⃣ Sending test message...');
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🧪 *Test Message*\n\nYour Telegram bot is working correctly!',
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${error}`);
    }

    console.log('   ✅ Simple message sent\n');
  } catch (error) {
    console.error('   ❌ Failed:', error.message);
    process.exit(1);
  }

  // Test 2: Notification-style message
  console.log('2️⃣ Sending notification...');
  try {
    const message = `📬 *New Newsletter Signup*

• *Email:* test@example.com
• *Profile ID:* 550e8400-e29b-41d4-a716-446655440000
• *Source:* /blog/test-post`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${error}`);
    }

    console.log('   ✅ Notification sent\n');
  } catch (error) {
    console.error('   ❌ Failed:', error.message);
    process.exit(1);
  }

  // Test 3: Comment notification
  console.log('3️⃣ Sending comment notification...');
  try {
    const message = `💬 *New Comment*

• *Author:* commenter@example.com
• *Post ID:* my-awesome-post
• *Preview:* This is a great article! I really enjoyed reading it and learned a lot...
• *Reply to:* Post`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${error}`);
    }

    console.log('   ✅ Comment notification sent\n');
  } catch (error) {
    console.error('   ❌ Failed:', error.message);
    process.exit(1);
  }

  console.log('✅ All tests passed! Check your Telegram app for the messages.\n');
  console.log('📱 You should see 3 messages in your chat with the bot.');
}

testTelegram().catch(console.error);
