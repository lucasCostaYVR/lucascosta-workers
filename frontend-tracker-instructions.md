# Frontend Instructions: Event Tracker Implementation

We are implementing a lightweight event tracking system that sends data to our Cloudflare Worker.

## Event Bus API Details

*   **Endpoint URL:** `https://api.lucascosta.tech/events/track`
*   **HTTP Method:** `POST`
*   **Authentication:**
    *   **No API Key required** (public endpoint).
    *   **Headers:**
        *   `Content-Type: application/json`
        *   `X-Tracking-Consent`: Set to `'granted'` if the user has accepted cookies/tracking. If missing or `'denied'`, the server will respect privacy settings (e.g., not setting cookies).
*   **Success Response:**
    *   Status: `200 OK`
    *   Body: `{ "status": "OK", "anonymousId": "..." }`

## Payload Format (Schema)

The worker expects a **WebEvent** object. The server handles `anonymousId` via HttpOnly cookies, so you **do not** need to send it.

```typescript
{
  // Required: Event name
  "name": "newsletter.subscribed", 

  // Optional: User identity
  "user": {
    "email": "user@example.com",
    "id": "user_123",       // Internal ID if logged in
    "profile_id": "..."     // CDP ID if available
  },

  // Optional: Context (highly recommended)
  "context": {
    "url": "https://lucascosta.tech/register",
    "path": "/register",
    "referrer": "https://google.com",
    "userAgent": "Mozilla/5.0...",
    "title": "Register - Lucas Costa"
  },

  // Optional: Custom properties
  "properties": {
    "source": "signup_form",
    "newsletter_id": "weekly-digest"
  }
}
```

## Event Schema for `newsletter.subscribed`

*   **`name`**: `"newsletter.subscribed"`
*   **`user.email`**: **Required**.
*   **`user.id`**: Send if the user is currently logged in.
*   **`properties.source`**: Send `"signup_form"`, `"footer"`, or `"modal"` to track where they signed up.

## Client-Side Tracker Requirements

Create a reusable `track()` function.

**Responsibilities:**
1.  **Context**: Automatically populate `context` (URL, Path, User Agent, Document Title).
2.  **Consent**: Read the `localStorage` item `tracking_consent` (values: `'granted'` | `'denied'`) and send the `X-Tracking-Consent` header.
3.  **Transport**: Send the POST request to the worker.

**Example Signature:**
```typescript
track(eventName: string, properties?: Record<string, any>, user?: { email?: string, id?: string })
```

## UI/UX Recommendations

*   **Checkbox Default:** **Unchecked**. (Best practice for GDPR/Privacy compliance).
*   **Label:** "Subscribe to my newsletter for engineering updates."
*   **Placement:** Both `/login` and `/register` are good places.

## Error Handling

**Fail Silently (Fire-and-Forget).**
Do not block the user's registration or login flow if the tracking event fails. Log the error to the console in development, but ignore it in production.
