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

## GDPR-Compliant Consent System

### Consent Model

We implement a **tiered consent approach** that balances user privacy with legitimate business needs:

**WITHOUT Consent (default):**
- ✅ Events stored anonymously (`identity_type` and `identity_value` = NULL)
- ✅ Aggregated metrics collected (page views, like counts, etc.)
- ✅ Functional features work (likes, copies saved to database)
- ❌ NO profile linkage (can't build user journeys)
- ❌ NO analytics notifications (no Telegram alerts)
- ❌ NO personalization/recommendations

**WITH Consent (user clicks "Accept"):**
- ✅ Events stored with full profile linkage
- ✅ User journey tracking enabled
- ✅ Personalization and recommendations possible
- ✅ Analytics notifications sent (Telegram alerts)
- ✅ Can stitch anonymous → identified user sessions

### How Consent is Detected

The backend reads consent from **two sources** (in order):

1. **`X-Tracking-Consent` header**: Set by frontend for server actions
   - Value: `"granted"` or `"denied"`
   - Used by: Server-side API routes, form submissions

2. **`cookie-consent` cookie** (fallback): Standard HTTP cookie
   - Value: `"granted"` or `"denied"`
   - Max-Age: 1 year
   - SameSite: Lax
   - Secure: true (production only)
   - Used by: Browser automatically sends with requests

**Default**: If neither present, consent = `false` (opt-in model, GDPR-compliant)

### Frontend Implementation

**Server Actions** (cannot access localStorage):
```typescript
// Always include X-Tracking-Consent header for server actions
headers: {
  'X-Tracking-Consent': consentGranted ? 'granted' : 'denied'
}
```

**Client-Side State** (LocalStorage is fine!):
- ✅ Store UI preferences in localStorage (liked snippets, theme, etc.)
- ✅ Purely frontend state - NOT subject to GDPR tracking rules
- ✅ Functional experience works regardless of consent
- ✅ Server respects consent separately for analytics

### Database Schema

The `events` table supports nullable identity fields:

```sql
ALTER TABLE events 
  ALTER COLUMN identity_type DROP NOT NULL,
  ALTER COLUMN identity_value DROP NOT NULL;
```

**Queries:**
- **Profile-linked events**: `WHERE identity_type IS NOT NULL AND identity_value IS NOT NULL`
- **Anonymous aggregated**: `WHERE identity_type IS NULL`

### Code Implementation

**Middleware** (`src/middlewares/consent.ts`):
```typescript
// Reads consent from header OR cookie, sets c.get('hasConsent')
// Default: false (opt-in)
```

**Event Storage** (`src/lib/db/events.ts`):
```typescript
// WITHOUT consent: Stores identity_type/identity_value as NULL
// WITH consent: Stores full identity for user journey tracking
insertEvent(supabase, event, options)
```

**Processors** (`src/handlers/processors/`):
```typescript
// FUNCTIONAL operations: Always execute (likes, copies)
// ANALYTICS operations: Only with consent (notifications, event tracking)
const hasConsent = event.traits?.hasConsent as boolean | undefined;
if (hasConsent) {
  // Send Telegram notification, enable personalization
}
```

### Legal Justification

- **Legitimate Interest**: Aggregated business metrics (page views, total likes)
- **Functional Necessity**: Core features work without consent (like counts)
- **GDPR Article 6(1)(f)**: Anonymous data is NOT personal data
- **Explicit Consent**: Required for profiling, journey tracking, personalization

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
