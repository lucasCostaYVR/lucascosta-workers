# Marketing Event Catalog

This document lists all standardized marketing events used in the CDP.
Use this as a reference when instrumenting new sources or creating analytics views.

## Naming Convention
Format: `entity.action` or `source.entity.action` (Current state is mixed)

## 1. Ghost Events (Source: `ghost`)
Events originating from the Ghost CMS webhook integration.

| Event Type | Description | Triggers Action |
| :--- | :--- | :--- |
| `subscriber.created` | New member signed up | • Upsert Profile<br>• Sync to Resend Audience |
| `newsletter.subscribed` | Member enabled emails | • Upsert Profile<br>• Reactivate Subscription<br>• Sync to Resend |
| `newsletter.unsubscribed` | Member disabled emails | • Upsert Profile<br>• Deactivate Subscription |
| `member.edited` | Member details changed | • Upsert Profile<br>• Sync updates to Resend |

## 2. Resend Events (Source: `resend`)
Events originating from Resend webhooks (Email Service Provider).

| Event Type | Description | Triggers Action |
| :--- | :--- | :--- |
| `email.sent` | Email sent to user | • Log Event |
| `email.delivered` | Email delivered | • Log Event |
| `email.opened` | User opened email | • Log Event |
| `email.clicked` | User clicked link | • Log Event |
| `email.bounced` | Delivery failed | • Log Event<br>• **Unsubscribe in Ghost** |
| `email.complained` | User marked as spam | • Log Event<br>• **Unsubscribe in Ghost** |
| `contact.created` | Contact added to audience | • Log Event |
| `contact.updated` | Contact details changed | • Log Event<br>• If `unsubscribed=true`, **Unsubscribe in Ghost** |

## 3. Web Events (Source: `web`)
Events originating from the client-side Pixel (`pixel.js`).
Prefix: `web.*`

| Event Type | Description | Triggers Action |
| :--- | :--- | :--- |
| `web.page_view` | User viewed a page | • Log Event<br>• Identity Resolution (Cookie/Magic Link) |
| `web.click` | Generic click | • Log Event |
| `web.form_submit` | Generic form submit | • Log Event<br>• Identity Merge (if email present) |

## Proposed Standardization (For Discussion)
Should we move to a stricter `entity.verb` format?

- `ghost.member.created` instead of `subscriber.created`?
- `email.subscription.updated` instead of `newsletter.subscribed`?
- `web.page.viewed` instead of `web.page_view`?
