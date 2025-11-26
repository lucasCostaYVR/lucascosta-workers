# Marketing Events Documentation

This document describes all marketing events tracked by the system, their sources, triggers, and how they're processed.

---

## Table of Contents

1. [Event Overview](#event-overview)
2. [Ghost Events](#ghost-events)
3. [Resend Events](#resend-events)
4. [Event Processing Flow](#event-processing-flow)
5. [Database Schema](#database-schema)

---

## Event Overview

All marketing events follow a standardized structure:

```typescript
{
  source: 'ghost' | 'resend',           // Event source platform
  type: string,                         // Specific event type
  identity_value: string,               // User identifier (email, etc.)
  identity_type: 'email' | 'anonymous_id',
  traits: {                             // User attributes
    email?: string,
    name?: string,
    status?: string,
    // ... other traits
  },
  timestamp: string,                    // ISO 8601 timestamp
  raw: any                              // Original webhook payload
}
```

---

## Ghost Events

Ghost CMS sends webhooks when members interact with your newsletter.

### 1. `subscriber.created`

**Trigger:** A new member signs up for your newsletter

**Source:** Ghost CMS → `/webhooks/ghost`

**Detection Logic:**
- Ghost webhook received
- `created_at === updated_at` in member data
- No previous newsletter subscriptions

**Example Payload:**
```json
{
  "member": {
    "current": {
      "email": "user@example.com",
      "name": "John Doe",
      "status": "free",
      "created_at": "2025-11-22T10:00:00.000Z",
      "updated_at": "2025-11-22T10:00:00.000Z",
      "newsletters": [
        {
          "id": "abc123",
          "name": "My Newsletter",
          "status": "active"
        }
      ]
    },
    "previous": {
      "newsletters": []
    }
  }
}
```

**Marketing Event:**
```json
{
  "source": "ghost",
  "type": "subscriber.created",
  "identity_value": "user@example.com",
  "identity_type": "email",
  "traits": {
    "email": "user@example.com",
    "name": "John Doe",
    "status": "free"
  },
  "timestamp": "2025-11-22T10:00:01.000Z",
  "raw": { /* full Ghost payload */ }
}
```

**Database Actions:**
- `profiles` table: Insert or update profile
- `email_subscriptions` table:
  - `subscribed = true`
  - `subscribed_at = event.timestamp`
  - `unsubscribed_at = null`
  - `source = 'ghost'`

---

### 2. `newsletter.subscribed`

**Trigger:** An existing member opts back into newsletters (re-subscribes)

**Source:** Ghost CMS → `/webhooks/ghost` (member.edited webhook)

**Detection Logic:**
- Ghost `member.edited` webhook received
- `previous.newsletters = []` (empty array - was unsubscribed)
- `current.newsletters.length > 0` (has newsletters - now subscribed)

**Example Payload:**
```json
{
  "member": {
    "current": {
      "email": "user@example.com",
      "newsletters": [
        {
          "id": "abc123",
          "name": "My Newsletter",
          "status": "active"
        }
      ]
    },
    "previous": {
      "newsletters": []  // Previously had no newsletters
    }
  }
}
```

**Marketing Event:**
```json
{
  "source": "ghost",
  "type": "newsletter.subscribed",
  "identity_value": "user@example.com",
  "identity_type": "email",
  "traits": {
    "email": "user@example.com",
    "name": "John Doe",
    "status": "free"
  },
  "timestamp": "2025-11-22T10:05:00.000Z",
  "raw": { /* full Ghost payload */ }
}
```

**Database Actions:**
- `profiles` table: Update profile
- `email_subscriptions` table:
  - `subscribed = true`
  - `subscribed_at = event.timestamp`
  - `unsubscribed_at = null`
  - `source = 'ghost'`

---

### 3. `newsletter.unsubscribed`

**Trigger:** A member opts out of newsletters (unsubscribes)

**Source:** Ghost CMS → `/webhooks/ghost` (member.edited webhook)

**Detection Logic:**
- Ghost `member.edited` webhook received
- `previous.newsletters.length > 0` (had newsletters - was subscribed)
- `current.newsletters = []` (empty array - now unsubscribed)

**Example Payload:**
```json
{
  "member": {
    "current": {
      "email": "user@example.com",
      "newsletters": []  // No longer subscribed to any newsletters
    },
    "previous": {
      "newsletters": [
        {
          "id": "abc123",
          "name": "My Newsletter",
          "status": "active"
        }
      ]  // Previously subscribed
    }
  }
}
```

**Marketing Event:**
```json
{
  "source": "ghost",
  "type": "newsletter.unsubscribed",
  "identity_value": "user@example.com",
  "identity_type": "email",
  "traits": {
    "email": "user@example.com",
    "name": "John Doe",
    "status": "free"
  },
  "timestamp": "2025-11-22T10:10:00.000Z",
  "raw": { /* full Ghost payload */ }
}
```

**Database Actions:**
- `profiles` table: Update profile
- `email_subscriptions` table:
  - `subscribed = false`
  - `unsubscribed_at = event.timestamp`
  - `source = 'ghost'`

---

### 4. `member.edited`

**Trigger:** A member's profile is updated (name, status, etc.) without newsletter changes

**Source:** Ghost CMS → `/webhooks/ghost` (member.edited webhook)

**Detection Logic:**
- Ghost `member.edited` webhook received
- Newsletter subscription status unchanged:
  - Both `previous` and `current` have newsletters, OR
  - Both `previous` and `current` have no newsletters

**Example Payload:**
```json
{
  "member": {
    "current": {
      "email": "user@example.com",
      "name": "John Smith",  // Name changed
      "newsletters": [{ "id": "abc123" }]
    },
    "previous": {
      "name": "John Doe",
      "newsletters": [{ "id": "abc123" }]  // Same newsletters
    }
  }
}
```

**Marketing Event:**
```json
{
  "source": "ghost",
  "type": "member.edited",
  "identity_value": "user@example.com",
  "identity_type": "email",
  "traits": {
    "email": "user@example.com",
    "name": "John Smith",
    "status": "free"
  },
  "timestamp": "2025-11-22T10:15:00.000Z",
  "raw": { /* full Ghost payload */ }
}
```

**Database Actions:**
- `profiles` table: Update profile (name, status, etc.)
- `email_subscriptions` table: No changes to subscription status

---

## Resend Events

**Status:** Not yet implemented

Planned events from Resend email service:
- `email.sent` - Email successfully sent
- `email.delivered` - Email delivered to inbox
- `email.opened` - Recipient opened email
- `email.clicked` - Recipient clicked link in email
- `email.bounced` - Email bounced
- `email.complained` - Recipient marked as spam

---

## Event Processing Flow

```
┌─────────────────────────────────────────┐
│  Webhook Received                       │
│  (Ghost or Resend)                      │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│  Middleware: validateWebhookKey         │
│  Check API key authentication           │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│  Handler: Route to specific handler     │
│  - Ghost: handleGhostWebhook            │
│  - Resend: handleResend                 │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│  Validate Payload with Zod Schema       │
│  Return 400 if invalid                  │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│  Determine Event Type                   │
│  - subscriber.created                   │
│  - newsletter.subscribed                │
│  - newsletter.unsubscribed              │
│  - member.edited                        │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│  Create Marketing Event Object          │
│  Standardized format                    │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│  Enqueue to Cloudflare Queue            │
│  (QUEUE binding)                        │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│  Queue Consumer: handleQueueConsumer    │
│  Process in batches                     │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│  Upsert to Supabase                     │
│  - profiles table                       │
│  - email_subscriptions table            │
└─────────────────────┬───────────────────┘
                      ↓
              ┌───────┴────────┐
              │                │
         SUCCESS?           FAILURE?
              │                │
         msg.ack()        msg.retry()
              ↓                ↓
           DONE         Retry (max 3x)
                             ↓
                    After 3 failures
                             ↓
                    Send to DLQ
```

---

## Database Schema

### `profiles` Table

Stores user profile information.

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Unique Constraint:** `email` (profiles_email_key)

---

### `email_subscriptions` Table

Tracks email subscription status over time.

```sql
CREATE TABLE email_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE NOT NULL REFERENCES profiles(id),
  subscribed BOOLEAN NOT NULL DEFAULT true,
  subscribed_at TIMESTAMP,
  unsubscribed_at TIMESTAMP,
  source VARCHAR(50) NOT NULL,  -- 'ghost', 'resend', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Unique Constraint:** `profile_id`

**Subscription Logic:**
- When `subscribed = true`: User is currently subscribed
  - `subscribed_at` = timestamp of most recent subscription
  - `unsubscribed_at` = null
- When `subscribed = false`: User is currently unsubscribed
  - `unsubscribed_at` = timestamp of most recent unsubscription
  - `subscribed_at` = timestamp of their last subscription

---

## Event Type Decision Matrix

| Scenario | previous.newsletters | current.newsletters | Event Type | subscribed |
|----------|---------------------|---------------------|------------|------------|
| New signup | `[]` or undefined | `[...]` (1+) | `subscriber.created` | `true` |
| Re-subscribe | `[]` (0) | `[...]` (1+) | `newsletter.subscribed` | `true` |
| Unsubscribe | `[...]` (1+) | `[]` (0) | `newsletter.unsubscribed` | `false` |
| Profile update | `[...]` (1+) | `[...]` (1+) | `member.edited` | unchanged |
| Profile update | `[]` (0) | `[]` (0) | `member.edited` | unchanged |

---

## Error Handling

### Webhook Level
- Invalid API key → 401 Unauthorized
- Invalid payload structure → 400 Bad Request
- Processing error → 500 Internal Server Error
- All errors logged with structured logger

### Queue Level
- Supabase error → `msg.retry()` (max 3 attempts)
- After 3 failures → Send to Dead Letter Queue (DLQ)
- DLQ messages logged for manual investigation

---

## Future Events

### Planned Ghost Events
- `member.deleted` - Member account deleted

### Planned Resend Events
- `email.sent` - Email sent
- `email.delivered` - Email delivered
- `email.opened` - Email opened
- `email.clicked` - Link clicked
- `email.bounced` - Email bounced
- `email.complained` - Marked as spam

### Planned Custom Events (Client-side)
- `page.viewed` - Page view
- `form.submitted` - Form submission
- `product.viewed` - Product viewed
- `checkout.started` - Checkout initiated

---

## Testing

### Manual Testing

Send test webhooks to your endpoints:

**Subscriber Created:**
```bash
curl -X POST "https://your-worker.workers.dev/webhooks/ghost?key=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d @test-payloads/subscriber-created.json
```

**Newsletter Unsubscribed:**
```bash
curl -X POST "https://your-worker.workers.dev/webhooks/ghost?key=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d @test-payloads/newsletter-unsubscribed.json
```

### Verify in Database

```sql
-- Check profile was created/updated
SELECT * FROM profiles WHERE email = 'test@example.com';

-- Check subscription status
SELECT * FROM email_subscriptions 
WHERE profile_id = (SELECT id FROM profiles WHERE email = 'test@example.com');
```

---

## Monitoring

### Key Metrics to Track

1. **Event Volume**
   - Events received per minute/hour/day
   - Events by type
   - Events by source (Ghost, Resend)

2. **Processing Success Rate**
   - Messages acknowledged vs. retried
   - DLQ depth (should be near zero)
   - Average processing time

3. **Subscription Metrics**
   - New subscribers per day
   - Unsubscribe rate
   - Re-subscription rate
   - Active subscriber count

4. **Error Rates**
   - 4xx errors (client errors)
   - 5xx errors (server errors)
   - Queue processing failures
   - Database errors

---

## Changelog

### 2025-11-22
- ✅ Implemented Ghost events: subscriber.created, newsletter.subscribed, newsletter.unsubscribed, member.edited
- ✅ Added Dead Letter Queue (DLQ) for failed messages
- ✅ Implemented structured logging
- ✅ Added queue consumer with automatic retries

### Future
- ⏳ Implement Resend email events
- ⏳ Add client-side event tracking
- ⏳ Build analytics dashboard
