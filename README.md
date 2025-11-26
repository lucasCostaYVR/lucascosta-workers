```txt
npm install
npm run dev
```

```txt
npm run deploy
```

[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```txt
npm run cf-typegen
```

Pass the `CloudflareBindings` as generics when instantiation `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## Webhooks

### Resend Webhooks
Configure your Resend webhooks to point to:
`https://api.lucascosta.tech/webhooks/resend?key=YOUR_WEBHOOK_SECRET`

Supported events:
- `email.bounced` (Syncs unsubscribe to Ghost)
- `email.complained` (Syncs unsubscribe to Ghost)
- `email.sent`, `email.delivered`, `email.opened`, `email.clicked` (Logged to DB)

### Ghost Webhooks
Configure your Ghost webhooks to point to:
`https://api.lucascosta.tech/webhooks/ghost?key=YOUR_WEBHOOK_SECRET`

## Environment Variables

Ensure the following variables are set in `.dev.vars` (local) and Cloudflare secrets (prod):

### Core Services
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY`: Supabase service role key
- `GHOST_ADMIN_API_KEY`: Admin API key for Ghost (for syncing unsubscribes)
- `GHOST_API_URL`: URL of your Ghost blog (e.g. `https://lucascosta.tech`)
- `RESEND_API_KEY`: Resend API Key
- `RESEND_AUDIENCE_ID`: Resend Audience ID
- `WEBHOOK_SECRET`: Secret key for protecting webhook endpoints

### Notion CMS Integration
- `NOTION_API_KEY`: Notion integration API key
- `NOTION_DATABASE_ID`: Notion database ID for blog posts

### Telegram Notifications (Optional)
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from @BotFather
- `TELEGRAM_CHAT_ID`: Your personal Telegram chat ID

See [docs/TELEGRAM_SETUP.md](./docs/TELEGRAM_SETUP.md) for Telegram setup instructions.

## Features

- 📊 **Analytics Tracking**: Cookie-based identity resolution with event tracking
- 📬 **Email Management**: Bidirectional sync between Resend and Ghost
- 📝 **CMS Integration**: Notion ↔ Supabase bidirectional sync for blog posts
- 📈 **Dashboard Exports**: Automated analytics exports to Notion dashboards
- 🔔 **Telegram Notifications**: Real-time alerts for signups, comments, contact forms, and publishing events
- ⏰ **Scheduled Jobs**: Automated dashboard updates every 15 minutes + weekly snapshots
