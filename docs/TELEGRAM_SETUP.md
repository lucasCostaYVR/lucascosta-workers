# Telegram Bot Setup Guide

This guide will help you set up Telegram notifications for your Cloudflare Worker.

## What Gets Notified

The bot sends you real-time Telegram notifications for:

- 📬 **Newsletter Signups** - New email subscriptions
- 💬 **Comments** - New blog comments (with preview)
- 📨 **Contact Forms** - New contact form submissions
- ✨ **Post Published** - When a post status changes to published
- 🔒 **Post Unpublished** - When a post status changes to draft
- 📊 **Analytics Syncs** - When dashboard data exports to Notion
- 🔄 **Bulk Syncs** - When multiple posts are synced from Notion

## Step 1: Create Your Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the prompts:
   - Choose a name (e.g., "Lucas Blog Notifications")
   - Choose a username (e.g., "lucas_blog_bot")
4. BotFather will give you a **Bot Token** like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
5. Save this token securely - you'll need it in Step 3

## Step 2: Get Your Chat ID

You need to get your personal Telegram chat ID so the bot knows where to send messages.

### Option A: Run the Helper Script (Recommended)

1. **Send a message to your bot first:**
   - Open Telegram
   - Search for your bot by username
   - Send it any message (like "Hello")

2. **Run the script:**
   ```bash
   node scripts/get_telegram_chat_id.js
   ```

3. The script will display your chat ID:
   ```
   Chat ID: 123456789
     Type: private
     Name: Lucas
     Username: @yourusername
   
   📋 Add this to your .dev.vars:
   TELEGRAM_CHAT_ID="123456789"
   ```

### Option B: Manual Method

1. Send a message to your bot in Telegram
2. Visit this URL in your browser (replace `YOUR_BOT_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
3. Look for `"chat":{"id":123456789` in the response
4. That number is your chat ID

## Step 3: Configure Local Development

Add these to your `.dev.vars` file:

```bash
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_CHAT_ID="123456789"
```

## Step 4: Test Locally

Run your worker locally to test notifications:

```bash
npm run dev
```

Then trigger an event (e.g., newsletter signup via your web form). You should receive a Telegram notification!

## Step 5: Deploy to Production

Add the secrets to Cloudflare Workers:

```bash
# Add bot token
npx wrangler secret put TELEGRAM_BOT_TOKEN
# Paste your bot token when prompted

# Add chat ID
npx wrangler secret put TELEGRAM_CHAT_ID
# Paste your chat ID when prompted
```

## Step 6: Deploy Your Worker

```bash
npm run deploy
```

## Notification Examples

### Newsletter Signup
```
📬 New Newsletter Signup

• Email: user@example.com
• Profile ID: 550e8400-e29b-41d4-a716-446655440000
• Source: /blog/my-awesome-post
```

### New Comment
```
💬 New Comment

• Author: commenter@example.com
• Post ID: post-slug
• Preview: Great article! I really enjoyed reading...
• Reply to: Post
```

### Contact Form
```
📨 New Contact Form

• Name: John Doe
• Email: john@example.com
• Subject: Question about your services
• Message: Hi, I wanted to ask about...
```

### Post Published
```
✨ Post Published

• Title: My Awesome Blog Post
• Slug: my-awesome-post
• Notion ID: 123abc456def
```

### Analytics Sync
```
📊 Analytics Sync Complete

• Database: BLOG_ANALYTICS
• Rows: 15
• Created: 0
• Updated: 15
```

## Troubleshooting

### Not receiving notifications?

1. **Check bot token is correct:**
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
   ```
   Should return your bot info.

2. **Verify chat ID:**
   - Make sure you sent a message to the bot first
   - Run the `get_telegram_chat_id.js` script again

3. **Check worker logs:**
   ```bash
   npx wrangler tail
   ```
   Look for "Failed to send Telegram notification" errors.

4. **Test the Telegram client directly:**
   ```bash
   node scripts/test_telegram.js
   ```

### Bot not responding?

- Make sure the bot token is active (check with BotFather)
- Verify you've sent at least one message to the bot
- Check that the bot isn't blocked

### Notifications are duplicated?

- This is expected during local development if you have multiple terminal sessions running
- In production, each event is processed exactly once

## Privacy & Security

- **Bot Token** is sensitive - never commit it to git
- **Chat ID** is your personal Telegram user ID - keep it private
- The bot can only send messages, it cannot read your Telegram messages
- Notifications are sent over Telegram's encrypted API
- All notifications fail gracefully - if Telegram is down, events still get processed and saved to your database

## Disabling Notifications

To temporarily disable notifications without changing code:

1. Remove the secrets from Cloudflare:
   ```bash
   npx wrangler secret delete TELEGRAM_BOT_TOKEN
   npx wrangler secret delete TELEGRAM_CHAT_ID
   ```

2. Or comment out the vars in `.dev.vars` for local testing

The worker will automatically skip Telegram notifications when credentials are missing.

## Advanced: Group Notifications

To send notifications to a Telegram group instead of personal chat:

1. Create a Telegram group
2. Add your bot to the group
3. Make the bot an admin
4. Get the group chat ID (it will be negative, like `-123456789`)
5. Use the group chat ID instead of your personal chat ID

## Support

If you run into issues, check:
- [Telegram Bot API Docs](https://core.telegram.org/bots/api)
- Worker logs: `npx wrangler tail`
- The source code: `src/lib/telegram.ts`
