# Database Operations Layer

This directory contains domain-specific database operations organized into focused modules.

## Structure

```
src/lib/db/
├── index.ts          # Re-exports all database operations
├── profiles.ts       # Profile-related operations
├── subscriptions.ts  # Email subscription operations
└── events.ts         # Marketing event operations
```

## Usage

### Import from the index

```typescript
import {
  getSupabaseClient,
  upsertProfileFromEvent,
  activateEmailSubscription,
  insertEvent,
} from './lib/db';
```

## Modules

### `profiles.ts`

Operations for managing user profiles.

**Functions:**
- `upsertProfileFromEvent(supabase, event)` - Creates or updates a profile from a marketing event
- `getProfileByEmail(supabase, email)` - Retrieves a profile by email address

**Example:**
```typescript
const profile = await upsertProfileFromEvent(supabase, event);
console.log(profile.id, profile.email);
```

---

### `subscriptions.ts`

Operations for managing email subscriptions.

**Functions:**
- `activateEmailSubscription(supabase, profileId, event)` - Activates/reactivates a subscription
- `deactivateEmailSubscription(supabase, profileId, event)` - Deactivates a subscription
- `getEmailSubscription(supabase, profileId)` - Gets subscription status

**Example:**
```typescript
await activateEmailSubscription(supabase, profile.id, event);
```

---

### `events.ts`

Operations for managing events in the `marketing_events` table.

**Functions:**
- `insertEvent(supabase, event, options?)` - Inserts an event into the marketing_events table
- `getEventsByIdentity(supabase, identityType, identityValue, limit?)` - Gets events for a specific identity
- `getEventsByType(supabase, eventType, limit?)` - Gets events of a specific type

**Options:**
- `correlation_id` - Optional ID to link related events
- `meta` - Optional metadata (request_id, ip, user_agent, etc.)

**Example:**
```typescript
await insertEvent(supabase, event, {
  correlation_id: 'batch_123',
  meta: { request_id: req.headers.get('cf-request-id') }
});
```

---

## Pattern: Queue Handler

All queue handlers follow this pattern:

```typescript
export async function handleEventType(event: MarketingEvent, env: Bindings) {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);

  try {
    // 1. Upsert profile
    const profile = await upsertProfileFromEvent(supabase, event);
    
    // 2. Insert marketing event
    await insertMarketingEvent(supabase, event);
    
    // 3. Update domain-specific tables (if needed)
    await activateEmailSubscription(supabase, profile.id, event);
    
    logger.info('Successfully processed event', { profileId: profile.id });
  } catch (error) {
    logger.error('Failed to process event', { error });
    throw error;
  }
}
```

## Benefits

✅ **Separation of Concerns** - Database logic separated from business logic  
✅ **Reusability** - Functions can be used across multiple handlers  
✅ **Testability** - Easy to mock and unit test  
✅ **Type Safety** - Full TypeScript support with return types  
✅ **Error Handling** - Consistent error messages and patterns  
✅ **Maintainability** - Changes to DB operations in one place  

## Adding New Operations

To add a new database operation:

1. **Choose the appropriate module** (or create a new one)
2. **Define the function** with clear parameter and return types
3. **Add JSDoc comments** explaining what it does
4. **Export from `index.ts`** for easy imports
5. **Follow the error handling pattern** - throw descriptive errors

Example:

```typescript
// In profiles.ts
/**
 * Updates a profile's status
 */
export async function updateProfileStatus(
  supabase: SupabaseClient,
  profileId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Failed to update profile status: ${error.message}`);
  }
}
```
