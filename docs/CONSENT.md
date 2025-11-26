# Tracking Consent & Cookieless Fallback

This system implements a GDPR/CCPA compliant "Cookieless Fallback" mechanism.

## How it works

1.  **Client-Side**: The pixel script sends an `X-Tracking-Consent` header.
    *   `granted`: User accepted cookies.
    *   `denied` (or missing): User denied or hasn't accepted yet.

2.  **Middleware**: `src/middlewares/consent.ts` parses this header.

3.  **Identity Logic**: `src/lib/identity.ts` checks the consent status.
    *   **Consent Granted**: Reads/Writes `lc_anon_id` cookie (persistent identity).
    *   **Consent Denied**: Generates a random, transient UUID for the request. **No cookies are read or written.**

## Usage

### Client-Side Implementation

When sending events from your website, check the user's consent status and set the header accordingly.

```javascript
// Example: Using fetch
const userConsent = localStorage.getItem('cookie_consent'); // 'granted' | 'denied'

fetch('https://your-worker.workers.dev/events/ingest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Tracking-Consent': userConsent === 'granted' ? 'granted' : 'denied'
  },
  body: JSON.stringify(eventPayload)
});
```

### Server-Side Behavior

| Header | Cookie Exists? | Result |
| :--- | :--- | :--- |
| `granted` | No | **Set-Cookie** sent. Persistent profile created. |
| `granted` | Yes | Cookie read. History linked. |
| `denied` | No | **No Cookie** set. Event logged with random ID. No profile merge. |
| `denied` | Yes | Cookie **ignored**. Event logged with random ID. No history link. |

## Code Structure

*   `src/middlewares/consent.ts`: Middleware logic.
*   `src/lib/identity.ts`: Identity resolution with consent check.
*   `src/handlers/web-events.ts`: Logs consent status.
*   `src/index.ts`: Applies middleware to `/events/ingest`.
