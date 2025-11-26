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

## Example: Newsletter Subscription (Server Action)

```typescript
'use server'

export async function subscribeToNewsletter(
  email: string,
  pathname: string,
  pageTitle: string
) {
  const event = {
    name: 'newsletter.subscribed',
    context: {
      page: {
        path: pathname,
        url: `${process.env.NEXT_PUBLIC_SITE_URL}${pathname}`,
        title: pageTitle
      },
      userAgent: headers().get('user-agent') || '',
      locale: 'en-US'
    },
    properties: {
      source: 'footer_form'
    },
    user: {
      email: email
    }
  };

  await fetch(`${process.env.WORKER_URL}/events/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': process.env.WEBHOOK_SECRET!,
    },
    body: JSON.stringify(event),
  });
}
```

## Example: Post Like (Server Action)

```typescript
'use server'

export async function likePost(
  postId: string,
  postSlug: string,
  pathname: string
) {
  const userEmail = await getCurrentUserEmail(); // Your auth logic

  const event = {
    name: 'post.liked',
    context: {
      page: {
        path: pathname,
        url: `${process.env.NEXT_PUBLIC_SITE_URL}${pathname}`,
        title: document.title // Pass from client
      },
      userAgent: headers().get('user-agent') || '',
      locale: 'en-US'
    },
    properties: {
      post_id: postId,
      post_slug: postSlug
    },
    user: userEmail ? {
      email: userEmail
    } : undefined
  };

  await fetch(`${process.env.WORKER_URL}/events/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': process.env.WEBHOOK_SECRET!,
    },
    body: JSON.stringify(event),
  });
}
```

## Example: Page View (Client Component)

```typescript
'use client'

import { useEffect } from 'react'

export function PageViewTracker() {
  useEffect(() => {
    const event = {
      name: 'page.viewed',
      context: {
        page: {
          path: window.location.pathname,
          url: window.location.href,
          title: document.title,
          referrer: document.referrer,
          search: window.location.search
        },
        userAgent: navigator.userAgent,
        locale: navigator.language
      }
    };

    fetch(`${process.env.NEXT_PUBLIC_WORKER_URL}/events/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
  }, []);

  return null;
}
```

## Endpoints

- `/events/track` - Public endpoint for client-side events (CORS enabled, no auth)
- `/events/ingest` - Server-side endpoint (requires `x-webhook-secret` header)

## Backend Processing

1. Event arrives at worker
2. Worker reads `anonymous_id` cookie (or creates one)
3. Worker resolves identity (anonymous vs. email)
4. Event transformed to `MarketingEvent` internal format
5. Queued for async processing
6. Queue consumer routes to appropriate handler
7. Data stored in `marketing_events` table
8. Identity graph updated if needed

Check the `marketing_events` table. The `traits` JSON should look like:
```json
{
  "email": "...",
  "source": "...",
  "context": {
    "page": {
      "path": "/blog/my-post"
    }
  }
}
```

This will allow us to build an "Attribution View" to see which blog posts drive the most subscribers.

