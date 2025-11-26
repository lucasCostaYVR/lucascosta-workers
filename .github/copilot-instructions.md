# Event Tracking - Standard Event Structure

## Overview

All events sent from the frontend (Next.js) to the Workers backend follow a standard WebEvent structure. The backend handles identity resolution (anonymous ID from cookies, user identification, etc.) automatically.

## Standard Event Structure

```typescript
{
  name: string,              // Event name (e.g., 'page.viewed', 'newsletter.subscribed', 'post.liked')
  
  context: {                 // Page and browser context
    page: {
      path: string,          // Current path (e.g., '/blog/my-post')
      url: string,           // Full URL
      title: string,         // Page title
      referrer?: string,     // Referrer URL
      search?: string        // Query string
    },
    userAgent: string,       // Browser user agent
    locale: string,          // Browser language (e.g., 'en-US')
    ...customContext         // Any additional context fields
  },
  
  properties?: {             // Event-specific properties
    [key: string]: any       // Custom data for this event
  },
  
  user?: {                   // User identification (optional - only if authenticated)
    email?: string,          // User's email
    id?: string,             // User's ID from your auth system
    profile_id?: string,     // Profile ID (for magic links)
    name?: string            // User's display name
  }
}
```

## Important Notes

- **Anonymous ID**: NOT sent from frontend - the backend reads it from cookies automatically
- **Timestamp**: NOT sent from frontend - the backend adds it server-side
- **Identity Resolution**: Backend handles merging anonymous → identified users automatically
- **Context is Required**: Always include `context.page` for conversion attribution

---

# Code Organization

## Folder Structure

The codebase follows a clean, maintainable architecture with clear separation of concerns:

```
src/
├── handlers/
│   ├── webhooks/        # External event ingestion (POST endpoints)
│   ├── processors/      # Business logic (pure functions)
│   └── queue/           # Queue consumers (routing only)
├── lib/
│   ├── clients/         # External service wrappers
│   └── utils/           # Pure utility functions
├── middlewares/         # Hono middleware
└── schemas.ts           # Zod schemas & types
```

## Architecture Rules

### handlers/webhooks/
- **Purpose**: HTTP endpoints that receive external events
- **Responsibilities**: Validate, transform, enqueue
- **Examples**: `/events/ingest` (web events), `/webhooks/ghost`, `/webhooks/resend`
- **Rule**: NO business logic - only validation and queue dispatch

### handlers/processors/
- **Purpose**: Pure business logic functions
- **Responsibilities**: Process events, update database, call external APIs
- **Examples**: `handlePostLiked`, `handleNewsletterSubscribed`, `processWebEvent`
- **Rule**: Must be pure, testable functions with clear inputs/outputs

### handlers/queue/
- **Purpose**: Queue message consumers
- **Responsibilities**: Route messages to appropriate processors
- **Examples**: `event-consumer.ts`, `dlq-consumer.ts`
- **Rule**: Routing only - delegate to processors/

### lib/clients/
- **Purpose**: External service integrations
- **Responsibilities**: API clients, SDKs, service wrappers
- **Examples**: `supabase.ts`, `ghost-admin.ts`, `resend.ts`, `telegram.ts`, `notion.ts`
- **Rule**: Encapsulate external dependencies, provide clean interfaces

### lib/utils/
- **Purpose**: Pure utility functions
- **Responsibilities**: Helper functions, formatters, validators
- **Examples**: `identity.ts`, `logger.ts`, `queue.ts`, `events.ts`
- **Rule**: NO side effects - must be pure functions

## Import Conventions

```typescript
// ✅ GOOD - Import from barrel exports
import { processWebEvent } from './handlers/processors';
import { createLogger, QueueManager } from './lib/utils';
import { getSupabaseClient, upsertProfileFromEvent } from './lib/clients/supabase';

// ❌ BAD - Direct file imports (harder to refactor)
import { processWebEvent } from './handlers/processors/web-events';
```

## Adding New Features

1. **New Event Type**: Add processor to `handlers/processors/`, update `handlers/queue/event-consumer.ts`
2. **New Webhook**: Add handler to `handlers/webhooks/`, update `src/index.ts` routes
3. **New External Service**: Add client to `lib/clients/`, export from `lib/clients/index.ts`
4. **New Utility**: Add to `lib/utils/`, export from `lib/utils/index.ts`
