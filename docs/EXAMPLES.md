# Example Event Payloads

This document contains real-world examples of webhook payloads and the marketing events they generate.

---

## Ghost: Subscriber Created

### Incoming Ghost Webhook
```json
{
  "member": {
    "current": {
      "id": "6920f3d109edf80001d63453",
      "uuid": "4eb03ef0-bc66-4dfc-bcf6-70410a2db94b",
      "email": "newuser@example.com",
      "name": "Jane Doe",
      "note": null,
      "geolocation": null,
      "subscribed": true,
      "created_at": "2025-11-22T10:00:00.000Z",
      "updated_at": "2025-11-22T10:00:00.000Z",
      "labels": [],
      "subscriptions": [],
      "avatar_image": "https://www.gravatar.com/avatar/...",
      "comped": false,
      "email_count": 0,
      "email_opened_count": 0,
      "email_open_rate": null,
      "status": "free",
      "last_seen_at": null,
      "tiers": [],
      "newsletters": [
        {
          "id": "691a426ad8d761000850fb7d",
          "name": "My Newsletter",
          "description": null,
          "status": "active"
        }
      ]
    },
    "previous": {
      "note": null,
      "updated_at": "2025-11-22T10:00:00.000Z",
      "newsletters": []
    }
  }
}
```

### Generated Marketing Event
```json
{
  "source": "ghost",
  "type": "subscriber.created",
  "identity_value": "newuser@example.com",
  "identity_type": "email",
  "traits": {
    "email": "newuser@example.com",
    "name": "Jane Doe",
    "status": "free"
  },
  "timestamp": "2025-11-22T10:00:01.234Z",
  "raw": { /* full Ghost payload above */ }
}
```

### Database Result
```sql
-- profiles table
INSERT INTO profiles (email, name, status, updated_at)
VALUES ('newuser@example.com', 'Jane Doe', 'free', '2025-11-22T10:00:01.234Z')
ON CONFLICT (email) DO UPDATE SET
  name = 'Jane Doe',
  status = 'free',
  updated_at = '2025-11-22T10:00:01.234Z';

-- email_subscriptions table
INSERT INTO email_subscriptions (profile_id, subscribed, subscribed_at, source)
VALUES ((SELECT id FROM profiles WHERE email = 'newuser@example.com'), 
        true, 
        '2025-11-22T10:00:01.234Z', 
        'ghost')
ON CONFLICT (profile_id) DO UPDATE SET
  subscribed = true,
  subscribed_at = '2025-11-22T10:00:01.234Z',
  unsubscribed_at = NULL;
```

---

## Ghost: Newsletter Unsubscribed

### Incoming Ghost Webhook
```json
{
  "member": {
    "current": {
      "id": "6920f3d109edf80001d63453",
      "uuid": "4eb03ef0-bc66-4dfc-bcf6-70410a2db94b",
      "email": "hello+test@lucascosta.tech",
      "name": "Lucas hello",
      "note": null,
      "geolocation": null,
      "subscribed": false,
      "created_at": "2025-11-21T23:20:49.000Z",
      "updated_at": "2025-11-21T23:24:37.000Z",
      "labels": [],
      "subscriptions": [],
      "avatar_image": "https://www.gravatar.com/avatar/...",
      "comped": false,
      "email_count": 0,
      "email_opened_count": 0,
      "email_open_rate": null,
      "status": "free",
      "last_seen_at": null,
      "tiers": [],
      "newsletters": []
    },
    "previous": {
      "note": null,
      "updated_at": "2025-11-21T23:20:49.000Z",
      "newsletters": [
        {
          "id": "691a426ad8d761000850fb7d",
          "name": "Lucas Costa | Marketing Automation",
          "description": null,
          "status": "active"
        }
      ]
    }
  }
}
```

### Generated Marketing Event
```json
{
  "source": "ghost",
  "type": "newsletter.unsubscribed",
  "identity_value": "hello+test@lucascosta.tech",
  "identity_type": "email",
  "traits": {
    "email": "hello+test@lucascosta.tech",
    "name": "Lucas hello",
    "status": "free"
  },
  "timestamp": "2025-11-21T23:24:38.567Z",
  "raw": { /* full Ghost payload above */ }
}
```

### Database Result
```sql
-- profiles table (update existing)
UPDATE profiles 
SET name = 'Lucas hello',
    status = 'free',
    updated_at = '2025-11-21T23:24:38.567Z'
WHERE email = 'hello+test@lucascosta.tech';

-- email_subscriptions table
UPDATE email_subscriptions
SET subscribed = false,
    unsubscribed_at = '2025-11-21T23:24:38.567Z'
WHERE profile_id = (SELECT id FROM profiles WHERE email = 'hello+test@lucascosta.tech');
```

---

## Ghost: Newsletter Re-subscribed

### Incoming Ghost Webhook
```json
{
  "member": {
    "current": {
      "id": "6920f3d109edf80001d63453",
      "email": "comeback@example.com",
      "name": "John Smith",
      "status": "free",
      "created_at": "2025-11-20T10:00:00.000Z",
      "updated_at": "2025-11-22T15:30:00.000Z",
      "newsletters": [
        {
          "id": "691a426ad8d761000850fb7d",
          "name": "My Newsletter",
          "status": "active"
        }
      ]
    },
    "previous": {
      "updated_at": "2025-11-21T10:00:00.000Z",
      "newsletters": []
    }
  }
}
```

### Generated Marketing Event
```json
{
  "source": "ghost",
  "type": "newsletter.subscribed",
  "identity_value": "comeback@example.com",
  "identity_type": "email",
  "traits": {
    "email": "comeback@example.com",
    "name": "John Smith",
    "status": "free"
  },
  "timestamp": "2025-11-22T15:30:01.123Z",
  "raw": { /* full Ghost payload above */ }
}
```

### Database Result
```sql
-- email_subscriptions table
UPDATE email_subscriptions
SET subscribed = true,
    subscribed_at = '2025-11-22T15:30:01.123Z',
    unsubscribed_at = NULL
WHERE profile_id = (SELECT id FROM profiles WHERE email = 'comeback@example.com');
```

---

## Ghost: Member Profile Edited

### Incoming Ghost Webhook
```json
{
  "member": {
    "current": {
      "id": "6920f3d109edf80001d63453",
      "email": "user@example.com",
      "name": "Jane Smith",  // Name changed
      "status": "free",
      "created_at": "2025-11-20T10:00:00.000Z",
      "updated_at": "2025-11-22T16:00:00.000Z",
      "newsletters": [
        {
          "id": "691a426ad8d761000850fb7d",
          "name": "My Newsletter",
          "status": "active"
        }
      ]
    },
    "previous": {
      "note": "Old note",
      "updated_at": "2025-11-21T10:00:00.000Z",
      "newsletters": [
        {
          "id": "691a426ad8d761000850fb7d",
          "name": "My Newsletter",
          "status": "active"
        }
      ]
    }
  }
}
```

### Generated Marketing Event
```json
{
  "source": "ghost",
  "type": "member.edited",
  "identity_value": "user@example.com",
  "identity_type": "email",
  "traits": {
    "email": "user@example.com",
    "name": "Jane Smith",
    "status": "free"
  },
  "timestamp": "2025-11-22T16:00:01.456Z",
  "raw": { /* full Ghost payload above */ }
}
```

### Database Result
```sql
-- profiles table (update name only)
UPDATE profiles 
SET name = 'Jane Smith',
    status = 'free',
    updated_at = '2025-11-22T16:00:01.456Z'
WHERE email = 'user@example.com';

-- email_subscriptions table (no changes to subscription status)
-- Existing row remains unchanged
```

---

## Testing Payloads

Save these payloads to files and test your webhooks:

### Create `test-payloads/subscriber-created.json`
```bash
mkdir -p test-payloads
cat > test-payloads/subscriber-created.json << 'EOF'
{
  "member": {
    "current": {
      "id": "test123",
      "email": "test@example.com",
      "name": "Test User",
      "status": "free",
      "created_at": "2025-11-22T10:00:00.000Z",
      "updated_at": "2025-11-22T10:00:00.000Z",
      "newsletters": [{"id": "nl1", "name": "Test Newsletter", "status": "active"}]
    },
    "previous": {
      "updated_at": "2025-11-22T10:00:00.000Z",
      "newsletters": []
    }
  }
}
EOF
```

### Test Command
```bash
curl -X POST "https://your-worker.workers.dev/webhooks/ghost?key=YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d @test-payloads/subscriber-created.json
```

---

## Event Flow Summary

```
Webhook → Validate → Detect Type → Create Event → Queue → Process → Database
   ↓          ↓           ↓             ↓           ↓        ↓         ↓
Ghost      API Key   newsletters   Marketing   QUEUE   Consumer  Supabase
Payload     Auth      comparison     Event               ↓
                                                      profiles
                                                         +
                                                  subscriptions
```
