# CMS Queue System - Usage Guide

## Overview
The CMS Queue system handles bidirectional syncing between Notion and Supabase with three clear actions:

1. **IMPORT**: Notion → Supabase (your blog posts)
2. **EXPORT**: Supabase → Notion (your analytics dashboard)
3. **UPDATE**: Ad-hoc updates to Notion pages

## Configuration (`src/lib/cms-mapping.ts`)

Add new data sources here:

```typescript
{
  key: 'BLOG_ANALYTICS',
  notionDatabaseId: 'abc123...', // Your Notion Dashboard DB ID
  supabaseView: 'dashboard_content_leaderboard',
  syncDirection: ['to_notion'],
  description: 'Blog performance metrics'
}
```

## Usage Examples

### 1. Import from Notion (Webhook)
```typescript
const queue = new QueueManager(env);

// Triggered by Notion webhook when a post is edited
await queue.importFromNotion('BLOG_POSTS', { 
  pageId: '123', 
  force: true 
});
```

### 2. Export to Notion (Cron Job)
```typescript
// Triggered by cron every hour to update your dashboard
await queue.exportToNotion('BLOG_ANALYTICS', { 
  clearExisting: true 
});

await queue.exportToNotion('WEEKLY_PULSE');
```

### 3. Update a Page
```typescript
// Mark a post as published
await queue.updateNotionPage('page_123', {
  Status: { status: { name: 'Published' } }
});
```

## Setting up your Dashboard Sync (Cron)

1. Add your Notion Dashboard DB IDs to `DATA_SOURCES`
2. Create a scheduled worker in `wrangler.jsonc`:
```json
{
  "triggers": {
    "crons": ["0 * * * *"] // Every hour
  }
}
```
3. Use `queue.exportToNotion('BLOG_ANALYTICS')` in the cron handler
