# Identity Resolution & Profile Merging

This document explains how the system tracks users across anonymous and identified sessions, merging their activity into a unified profile.

## Overview

Users can interact with your site in two states:
- **Anonymous**: Browsing without identifying themselves (tracked via cookie)
- **Identified**: Subscribed, logged in, or otherwise known by email

The identity resolution system ensures that all activity from a single user is linked to one profile, even as they transition from anonymous to identified.

---

## Architecture

### Core Concept: Unified Profiles

Every user (anonymous or identified) has **ONE profile** in the `profiles` table:

```sql
profiles:
  id (UUID, PK)
  email (nullable, unique when present)
  name
  status
  created_at
  updated_at
```

- **Anonymous users**: `email = NULL`
- **Identified users**: `email = 'user@example.com'`

### Identity Graph

The `identity_graph` table tracks **all identities** that belong to a profile:

```sql
identity_graph:
  id (UUID, PK)
  profile_id (UUID, FK → profiles.id)
  identity_type (email | anonymous_id | user_id)
  identity_value (user@example.com | anon_abc123 | ...)
  first_seen_at
  last_seen_at
  created_at
  updated_at
  
  UNIQUE(identity_type, identity_value)
```

**Key principle**: Each identity can only belong to ONE profile.

---

## User Journeys

### Journey 1: Anonymous → Subscriber

```
1. User visits site (no cookie)
   → Generate: anon_abc123
   → Database:
     - INSERT profiles (id=uuid1, email=NULL)
     - INSERT identity_graph (profile_id=uuid1, type='anonymous_id', value='anon_abc123')
   → Cookie: lc_anon_id = anon_abc123

2. User views 5 pages
   → marketing_events (identity_type='anonymous_id', identity_value='anon_abc123')

3. User subscribes via Ghost with email user@example.com
   → Ghost webhook → queue → subscriber-created handler
   → Database (via upsertProfileFromEvent):
     - INSERT profiles (id=uuid2, email='user@example.com')
     - INSERT email_subscriptions (profile_id=uuid2)
   → ⚠️ At this point: TWO separate profiles exist!

4. User browses site again (still has anon_abc123 cookie)
   → Web event: { user: { email: 'user@example.com' }, ... }
   → Queue consumer detects: identity_type='email' + traits.anonymousId='anon_abc123'
   → **MERGE TRIGGERED** via mergeAnonymousToEmail()
   → Database function:
     - MOVE all identities from uuid1 → uuid2
     - DELETE profiles WHERE id=uuid1
     - INSERT identity_graph (profile_id=uuid2, type='anonymous_id', value='anon_abc123')
   → ✅ Now: ONE profile (uuid2) with both email + anonymous_id linked

5. Future events
   → Any event with 'anon_abc123' OR 'user@example.com' → uuid2
```

### Journey 2: Subscriber → New Device

```
1. Existing subscriber (email=user@example.com, profile_id=uuid1)
2. User clears cookies or uses new device
3. Visits site → generates new anonymous ID: anon_def456
4. Browses anonymously
   → Database:
     - INSERT profiles (id=uuid2, email=NULL)  [temporary anonymous profile]
     - INSERT identity_graph (profile_id=uuid2, type='anonymous_id', value='anon_def456')

5. User logs in or is identified (via session/cookie/auth)
   → Web event: { user: { email: 'user@example.com' }, ... }
   → Cookie still has: anon_def456
   → **MERGE TRIGGERED**
   → Database function:
     - FIND profile_id by email → uuid1
     - FIND profile_id by anonymous_id → uuid2
     - MOVE all identities from uuid2 → uuid1
     - DELETE uuid2
     - INSERT identity_graph (profile_id=uuid1, type='anonymous_id', value='anon_def456')
   
6. ✅ Now: ONE profile (uuid1) with multiple anonymous IDs:
   - email: user@example.com
   - anonymous_id: anon_abc123 (from original device)
   - anonymous_id: anon_def456 (from new device)
```

### Journey 3: Pure Anonymous User

```
1. User visits site
   → anon_xyz789 cookie generated
   → Database:
     - INSERT profiles (id=uuid1, email=NULL)
     - INSERT identity_graph (profile_id=uuid1, type='anonymous_id', value='anon_xyz789')

2. User browses, never subscribes
   → All events: identity_type='anonymous_id', identity_value='anon_xyz789'
   → Profile remains anonymous (email=NULL)
   → Can still track journey, build audience, show personalized content
```

---

## Database Functions

All identity operations are **atomic PostgreSQL functions** for consistency and performance.

### 1. get_or_create_profile_by_anonymous_id()

**Purpose**: Get existing profile or create new anonymous profile

**Usage**:
```sql
SELECT get_or_create_profile_by_anonymous_id('anon_abc123');
-- Returns: profile_id (UUID)
```

**Logic**:
- Try to find profile via identity_graph
- If found: update last_seen_at, return profile_id
- If not found: INSERT new profile (email=NULL), link in identity_graph

---

### 2. merge_anonymous_to_email() ⭐ MAIN FUNCTION

**Purpose**: Atomically merge anonymous and email identities

**Usage**:
```sql
SELECT * FROM merge_anonymous_to_email(
  'user@example.com',  -- p_email
  'anon_abc123',       -- p_anonymous_id
  'John Doe',          -- p_name (optional)
  'free'               -- p_status (optional)
);
-- Returns: profile_id, was_new_profile, was_merged
```

**Logic** (handles all edge cases):

#### Case A: Both profiles exist (different IDs)
```
anonymous_profile (uuid1) + email_profile (uuid2) → MERGE
1. Move all identities from uuid1 → uuid2
2. Update uuid2 with any new data
3. DELETE uuid1
4. Return uuid2, was_merged=TRUE
```

#### Case B: Only anonymous exists
```
anonymous_profile (uuid1) exists, no email profile
1. UPDATE profiles SET email='user@example.com' WHERE id=uuid1
2. INSERT identity_graph (uuid1, 'email', 'user@example.com')
3. Return uuid1, was_merged=TRUE
```

#### Case C: Only email exists
```
email_profile (uuid1) exists, new anonymous ID
1. INSERT identity_graph (uuid1, 'anonymous_id', 'anon_abc123')
2. Return uuid1, was_merged=FALSE
```

#### Case D: Neither exists
```
Brand new user
1. INSERT profiles (email='user@example.com') → uuid1
2. INSERT identity_graph for both email + anonymous_id
3. Return uuid1, was_new_profile=TRUE
```

---

### 3. get_profile_by_identity()

**Purpose**: Lookup profile by any identity

**Usage**:
```sql
SELECT get_profile_by_identity('email', 'user@example.com');
SELECT get_profile_by_identity('anonymous_id', 'anon_abc123');
-- Returns: profile_id or NULL
```

---

### 4. get_identities_for_profile()

**Purpose**: View all identities linked to a profile (for debugging/analytics)

**Usage**:
```sql
SELECT * FROM get_identities_for_profile('uuid1');
-- Returns:
--   identity_type   | identity_value        | first_seen_at | last_seen_at
--   email           | user@example.com      | 2025-01-01    | 2025-01-05
--   anonymous_id    | anon_abc123           | 2024-12-28    | 2025-01-05
--   anonymous_id    | anon_def456           | 2025-01-02    | 2025-01-03
```

---

## Code Flow

### Web Event Handler (`/events/ingest`)

```typescript
// src/handlers/web-events.ts
1. Validate payload
2. Get/create anonymous ID from cookie (lc_anon_id)
3. Resolve identity priority: email > user_id > anonymous_id
4. Build marketing event
5. Queue for processing
```

### Web Event Queue Consumer

```typescript
// src/handlers/queue/web-events.ts
1. Check if identity_type='email' AND traits.anonymousId exists
   → YES: Call mergeAnonymousToEmail() → database handles merge
   → NO: Continue

2. Check if identity_type='anonymous_id'
   → Call getOrCreateProfileByAnonymousId() → ensure profile exists

3. Insert marketing event
```

### Ghost Subscriber Created

```typescript
// src/handlers/queue/subscriber-created.ts
1. Check if event has traits.anonymousId
   → YES: Call mergeAnonymousToEmail()
   → NO: Call upsertProfileFromEvent() (standard email profile)

2. Insert marketing event
3. Activate email subscription
```

---

## Key Benefits

✅ **Complete User Journey** - See all activity from first anonymous visit to identified subscriber  
✅ **Cross-Device Tracking** - Link multiple anonymous IDs to one email  
✅ **Atomic Operations** - Database functions prevent race conditions  
✅ **Privacy Compliant** - DELETE profile cascades to identity_graph  
✅ **Retroactive Linking** - Old anonymous events automatically linked after merge  
✅ **Flexible** - Support any identity type (email, phone, SSO ID, etc.)  

---

## Querying Examples

### Get all events for a user (by email)

```sql
-- 1. Find profile by email
SELECT profile_id FROM identity_graph 
WHERE identity_type = 'email' AND identity_value = 'user@example.com';

-- 2. Get all identities for this profile
SELECT identity_value FROM identity_graph 
WHERE profile_id = 'uuid1';

-- 3. Get all events for ANY of their identities
SELECT * FROM marketing_events
WHERE (identity_type, identity_value) IN (
  SELECT identity_type, identity_value FROM identity_graph
  WHERE profile_id = 'uuid1'
)
ORDER BY occurred_at DESC;
```

### See user journey

```sql
SELECT 
  me.occurred_at,
  me.type,
  me.identity_type,
  me.identity_value,
  me.traits
FROM marketing_events me
JOIN identity_graph ig ON 
  me.identity_type = ig.identity_type AND 
  me.identity_value = ig.identity_value
WHERE ig.profile_id = 'uuid1'
ORDER BY me.occurred_at ASC;
```

---

## Testing

### Test Scenario 1: Anonymous → Subscriber

```sql
-- 1. Create anonymous profile
SELECT get_or_create_profile_by_anonymous_id('test_anon_1');
-- Returns: uuid1

-- 2. Verify profile created
SELECT * FROM profiles WHERE id = 'uuid1';
-- email: NULL

-- 3. Subscribe with email
SELECT * FROM merge_anonymous_to_email('test@example.com', 'test_anon_1', 'Test User');
-- Returns: profile_id=uuid1, was_merged=TRUE

-- 4. Verify profile upgraded
SELECT * FROM profiles WHERE id = 'uuid1';
-- email: test@example.com

-- 5. Verify both identities linked
SELECT * FROM get_identities_for_profile('uuid1');
-- email: test@example.com
-- anonymous_id: test_anon_1
```

---

## Migration Steps

1. **Run migration**: Execute `migrations/001_identity_resolution.sql` in Supabase
2. **Deploy worker**: Deploy updated CloudFlare Worker code
3. **Test**: Send test events with anonymous IDs and emails
4. **Monitor**: Check Sentry for merge logs (was_merged=TRUE)
5. **Analyze**: Query identity_graph to see user journeys

---

## Future Enhancements

- **Phone number identity**: Add phone as identity_type
- **Social login**: Link OAuth provider IDs
- **Cross-domain tracking**: Share anonymous ID across subdomains
- **Merge confidence scores**: Track how certain we are about merges
- **Manual merge UI**: Admin interface to merge profiles manually
