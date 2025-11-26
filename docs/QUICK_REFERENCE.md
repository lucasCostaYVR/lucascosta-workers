# Quick Reference: Event Types

## Ghost Events (Implemented ✅)

| Event Type | When It Fires | Database Update |
|------------|---------------|-----------------|
| `subscriber.created` | New member signs up | `subscribed = true` |
| `newsletter.subscribed` | Member re-subscribes (0 → 1+ newsletters) | `subscribed = true` |
| `newsletter.unsubscribed` | Member unsubscribes (1+ → 0 newsletters) | `subscribed = false` |
| `member.edited` | Profile update, no newsletter change | No subscription change |

## Detection Logic

### subscriber.created
```
✓ New member webhook
✓ created_at === updated_at
✓ No previous newsletter history
```

### newsletter.subscribed
```
✓ member.edited webhook
✓ previous.newsletters.length === 0
✓ current.newsletters.length > 0
```

### newsletter.unsubscribed
```
✓ member.edited webhook
✓ previous.newsletters.length > 0
✓ current.newsletters.length === 0
```

### member.edited
```
✓ member.edited webhook
✓ Newsletter status unchanged (both have or both don't have)
```

## Database Fields

### When Subscribed (`subscribed = true`)
```sql
subscribed = true
subscribed_at = event.timestamp
unsubscribed_at = NULL
```

### When Unsubscribed (`subscribed = false`)
```sql
subscribed = false
unsubscribed_at = event.timestamp
subscribed_at = (previous timestamp, unchanged)
```

## API Endpoints

```
POST /webhooks/ghost?key=YOUR_SECRET
POST /webhooks/resend?key=YOUR_SECRET
```

## Common Issues

### Duplicate Key Error
**Problem:** `duplicate key value violates unique constraint "profiles_email_key"`

**Solution:** Use `onConflict: 'email'` in upsert:
```typescript
.upsert({ email: '...' }, { onConflict: 'email' })
```

### Newsletter Detection Not Working
**Problem:** Event type is always `member.edited`

**Solution:** Check that your schema includes `newsletters` in `previous`:
```typescript
previous: z.object({
  newsletters: z.array(...).optional()
})
```
