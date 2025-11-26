# Frontend Event Tracking Standards

We follow the **Segment Spec** for event structure. This ensures data consistency and allows for powerful analytics.

## 1. The `track()` Function Signature

Your tracking function should accept three arguments:

```typescript
track(
  eventName: string, 
  properties?: Record<string, any>, 
  options?: { 
    context?: Record<string, any>,
    user?: { email?: string, id?: string, profile_id?: string }
  }
)
```

## 2. Event Structure

### A. Page Views (`page.viewed`)
Automatically triggered on route change.

```javascript
track('page.viewed', {
  // Properties specific to the page content
  category: 'Blog',
  tags: ['Engineering', 'CDP']
}, {
  context: {
    page: {
      path: '/blog/my-post',
      url: 'https://...',
      title: 'My Post',
      referrer: '...'
    }
  }
});
```

### B. User Actions (`newsletter.subscribed`, `contact.submitted`)
Triggered by user interaction.

**Critical Rule:** Always include `context.page` so we know WHERE the action happened.

```javascript
track('newsletter.subscribed', {
  // Properties specific to the action
  source: 'footer_form', // or 'modal', 'hero'
  email: 'user@example.com'
}, {
  context: {
    page: {
      path: window.location.pathname, // CRITICAL for attribution
      title: document.title
    }
  },
  // Pass user info if available/relevant to the event
  user: {
    email: 'user@example.com'
  }
});
```

### C. Identity (`identify`)
Triggered when a user logs in or provides their email.

```javascript
track('identify', {
  // User traits
  email: 'user@example.com',
  name: 'Lucas Costa',
  plan: 'premium'
}, {
  user: {
    email: 'user@example.com',
    id: 'user_123'
  }
});
```

### D. User Object (Explicit Identification)
While the backend handles session stitching via cookies, you should explicitly pass the `user` object in `options` whenever the user identifies themselves (e.g., fills a form, logs in).

*   **`email`**: The primary key for identity resolution.
*   **`id`**: Your internal database ID (if logged in).
*   **`profile_id`**: The CDP Profile ID (used for Magic Links).

```javascript
// Example: Server Action for Form Submit
track('contact.submitted', {
  message: 'Hello!'
}, {
  user: {
    email: formData.get('email')
  }
});
```

## 3. Naming Conventions

*   **Format:** `Object Action` (Noun-Verb)
*   **Casing:** `snake_case` or `camelCase` (Pick one and stick to it. We currently use `dot.notation` for types like `newsletter.subscribed`).
*   **Good Examples:**
    *   `newsletter.subscribed`
    *   `form.submitted`
    *   `button.clicked`
*   **Bad Examples:**
    *   `clicked_signup` (Verb-Noun)
    *   `New Subscriber` (Spaces)

## 4. Implementation Checklist for Frontend Agent

1.  [ ] **Context Middleware:** Ensure every event automatically gets `context.page`, `context.userAgent`, and `context.locale`.
2.  [ ] **Server Actions:** When tracking from the server, manually pass `context.page.path` from the client.
3.  [ ] **Consent:** Respect the `X-Tracking-Consent` header.
