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

async function getTelegramChatId() {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .dev.vars');
    return;
  }

  console.log('🤖 Fetching recent updates from Telegram bot...\n');
  console.log('📱 Open Telegram and send a message to your bot first!\n');
  console.log('You can find your bot by searching for its username or using this link:');
  console.log(`https://t.me/YourBotUsername\n`);

  const url = `https://api.telegram.org/bot${botToken}/getUpdates`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.ok) {
    console.error('❌ Telegram API error:', data);
    return;
  }

  if (data.result.length === 0) {
    console.log('⚠️  No messages found. Please:');
    console.log('1. Open Telegram');
    console.log('2. Search for your bot');
    console.log('3. Send it any message (like "Hello")');
    console.log('4. Run this script again');
    return;
  }

  console.log('✅ Found messages! Here are your chat IDs:\n');
  
  const uniqueChats = new Map();
  data.result.forEach((update) => {
    if (update.message) {
      const chat = update.message.chat;
      const from = update.message.from;
      uniqueChats.set(chat.id, {
        chatId: chat.id,
        chatType: chat.type,
        firstName: from.first_name,
        username: from.username,
      });
    }
  });

  uniqueChats.forEach((info) => {
    console.log(`Chat ID: ${info.chatId}`);
    console.log(`  Type: ${info.chatType}`);
    console.log(`  Name: ${info.firstName}`);
    if (info.username) {
      console.log(`  Username: @${info.username}`);
    }
    console.log('');
  });

  console.log('📋 Add this to your .dev.vars:');
  const firstChatId = Array.from(uniqueChats.values())[0].chatId;
  console.log(`TELEGRAM_CHAT_ID="${firstChatId}"`);
}

getTelegramChatId().catch(console.error);
