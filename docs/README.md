# Documentation

Welcome to the marketing events documentation for the Cloudflare Workers project.

## 📚 Documentation Files

### [MARKETING_EVENTS.md](./MARKETING_EVENTS.md)
**Comprehensive guide to all marketing events**

- Event overview and structure
- Detailed documentation for each event type
- Event processing flow diagrams
- Database schema
- Error handling
- Testing guide
- Monitoring recommendations

**Use this when:** You need to understand how events work, add new event types, or troubleshoot issues.

---

### [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
**Quick lookup for event types and logic**

- Event types table
- Detection logic for each event
- Database field updates
- Common issues and solutions

**Use this when:** You need a quick reminder of event types or detection logic.

---

### [EXAMPLES.md](./EXAMPLES.md)
**Real-world payload examples**

- Complete webhook payloads
- Generated marketing events
- Database operations
- Testing commands

**Use this when:** You need to see actual examples or create test data.

---

## 🚀 Quick Start

### Understanding Events

1. Read [MARKETING_EVENTS.md](./MARKETING_EVENTS.md) for a complete overview
2. Check [EXAMPLES.md](./EXAMPLES.md) to see real payloads
3. Use [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for daily development

### Testing

```bash
# Send a test webhook
curl -X POST "https://your-worker.workers.dev/webhooks/ghost?key=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d @test-payloads/subscriber-created.json
```

### Monitoring

Check your Cloudflare Workers dashboard:
- Real-time logs (structured JSON in production, pretty-printed in dev)
- Queue metrics
- Error rates

---

## 📊 Current Event Support

| Source | Event Type | Status |
|--------|-----------|--------|
| Ghost | `subscriber.created` | ✅ Implemented |
| Ghost | `newsletter.subscribed` | ✅ Implemented |
| Ghost | `newsletter.unsubscribed` | ✅ Implemented |
| Ghost | `member.edited` | ✅ Implemented |
| Resend | Email events | ⏳ Planned |
| Custom | Client-side events | ⏳ Planned |

---

## 🔍 Event Detection Logic

### Ghost Newsletter Status

```
New Signup:
  previous.newsletters = [] (or empty)
  current.newsletters = [1+]
  → subscriber.created

Re-subscribe:
  previous.newsletters = [] (was unsubscribed)
  current.newsletters = [1+] (now subscribed)
  → newsletter.subscribed

Unsubscribe:
  previous.newsletters = [1+] (was subscribed)
  current.newsletters = [] (now unsubscribed)
  → newsletter.unsubscribed

Profile Update:
  Both have newsletters OR both don't have newsletters
  → member.edited
```

---

## 🗄️ Database Schema

### profiles
- `id` - UUID primary key
- `email` - Unique, user's email
- `name` - User's name
- `status` - Account status (free, paid, etc.)
- `created_at` - First seen
- `updated_at` - Last updated

### email_subscriptions
- `id` - UUID primary key
- `profile_id` - References profiles.id (unique)
- `subscribed` - Boolean, current status
- `subscribed_at` - When they subscribed
- `unsubscribed_at` - When they unsubscribed (if applicable)
- `source` - Where the subscription came from (ghost, resend)

---

## 🛠️ Troubleshooting

### Common Issues

**Duplicate key error:**
```
Error: duplicate key value violates unique constraint "profiles_email_key"
```
**Fix:** Ensure you're using `onConflict: 'email'` in your upsert.

**Event type always `member.edited`:**
```
Expected: newsletter.unsubscribed
Got: member.edited
```
**Fix:** Check that your schema includes `newsletters` in the `previous` object.

**Queue not processing:**
```
Events queued but not appearing in database
```
**Fix:** Check queue consumer logs, verify Supabase credentials, check DLQ for failed messages.

---

## 📝 Adding New Event Types

1. **Update the schema** in `src/schemas.ts`
2. **Create handler** in `src/handlers/{source}/{event-type}.ts`
3. **Update router** in `src/handlers/{source}/index.ts`
4. **Update queue consumer** in `src/handlers/queue-consumer.ts` if needed
5. **Document it** in `MARKETING_EVENTS.md`
6. **Add examples** in `EXAMPLES.md`
7. **Update quick reference** in `QUICK_REFERENCE.md`

---

## 🔗 Related Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Queues Docs](https://developers.cloudflare.com/queues/)
- [Ghost Webhooks](https://ghost.org/docs/webhooks/)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)

---

## 📮 Questions?

If you have questions or find issues with the documentation, please update it! The docs are living documents that should evolve with the codebase.
