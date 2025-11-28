import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  insertEvent,
  getEventsByIdentity,
  getEventsByType,
  type ProcessedEventRecord,
} from '../../src/lib/db/events'
import type { ProcessedEvent } from '../../src/schemas'
import dotenv from 'dotenv'

dotenv.config({ path: '.dev.vars' })

// Integration tests - These require a real Supabase connection
// Run with: npm test -- events.integration.test.ts
describe('Event Database Operations', () => {
  let supabase: ReturnType<typeof createClient>

  beforeAll(() => {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
    }

    supabase = createClient(supabaseUrl, supabaseKey)
  })

  describe('insertEvent', () => {
    it('should insert a valid event into the database', async () => {
      const event: ProcessedEvent = {
        source: 'web',
        type: 'page.viewed',
        identity_type: 'anonymous_id',
        identity_value: 'test_anon_' + Date.now(),
        traits: {
          page: {
            path: '/test',
            url: 'https://lucascosta.tech/test',
            title: 'Test Page',
          },
          userAgent: 'Test Agent',
          locale: 'en-US',
        },
        timestamp: new Date().toISOString(),
        raw: {
          name: 'page.viewed',
          context: {
            page: {
              path: '/test',
              url: 'https://lucascosta.tech/test',
              title: 'Test Page',
            },
            userAgent: 'Test Agent',
            locale: 'en-US',
          },
        },
      }

      const result = await insertEvent(supabase, event)

      expect(result).toBeDefined()
      expect(result.id).toBeDefined()
      expect(result.source).toBe('web')
      expect(result.type).toBe('page.viewed')
      expect(result.identity_type).toBe('anonymous_id')
      expect(result.identity_value).toBe(event.identity_value)
    })

    it('should store traits as JSONB', async () => {
      const event: ProcessedEvent = {
        source: 'web',
        type: 'comment.created',
        identity_type: 'email',
        identity_value: 'test_' + Date.now() + '@example.com',
        traits: {
          comment_id: 'comment_123',
          content: 'Test comment with special chars: @#$%',
          nested: {
            deep: {
              value: 42,
            },
          },
        },
        timestamp: new Date().toISOString(),
        raw: {},
      }

      const result = await insertEvent(supabase, event)

      expect(result.traits).toEqual(event.traits)
      expect(result.traits).toHaveProperty('nested.deep.value', 42)
    })

    it('should handle correlation_id and meta fields', async () => {
      const event: ProcessedEvent = {
        source: 'web',
        type: 'post.liked',
        identity_type: 'anonymous_id',
        identity_value: 'test_anon_' + Date.now(),
        traits: {},
        timestamp: new Date().toISOString(),
        raw: {},
      }

      const result = await insertEvent(supabase, event, {
        correlation_id: 'corr_123',
        meta: {
          experiment: 'test_experiment',
          variant: 'A',
        },
      })

      expect(result.correlation_id).toBe('corr_123')
      expect(result.meta).toEqual({
        experiment: 'test_experiment',
        variant: 'A',
      })
    })

    it('should set ingested_at automatically', async () => {
      const before = new Date()
      const event: ProcessedEvent = {
        source: 'web',
        type: 'page.viewed',
        identity_type: 'anonymous_id',
        identity_value: 'test_anon_' + Date.now(),
        traits: {},
        timestamp: new Date().toISOString(),
        raw: {},
      }

      const result = await insertEvent(supabase, event)
      const after = new Date(Date.now() + 1000) // Add 1 second buffer for DB latency

      expect(result.ingested_at).toBeDefined()
      const ingestedAt = new Date(result.ingested_at)
      expect(ingestedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(ingestedAt.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  describe('getEventsByIdentity', () => {
    it('should retrieve events for a specific identity', async () => {
      const identityValue = 'test_identity_' + Date.now()
      
      // Insert test events
      const event1: ProcessedEvent = {
        source: 'web',
        type: 'page.viewed',
        identity_type: 'anonymous_id',
        identity_value: identityValue,
        traits: { page_title: 'Page 1' },
        timestamp: new Date().toISOString(),
        raw: {},
      }

      const event2: ProcessedEvent = {
        source: 'web',
        type: 'post.liked',
        identity_type: 'anonymous_id',
        identity_value: identityValue,
        traits: { post_id: 'post_1' },
        timestamp: new Date(Date.now() + 1000).toISOString(),
        raw: {},
      }

      await insertEvent(supabase, event1)
      await insertEvent(supabase, event2)

      // Retrieve events
      const events = await getEventsByIdentity(
        supabase,
        'anonymous_id',
        identityValue,
        10
      )

      expect(events.length).toBeGreaterThanOrEqual(2)
      expect(events[0].identity_value).toBe(identityValue)
      expect(events[1].identity_value).toBe(identityValue)
      
      // Should be ordered by occurred_at DESC
      const timestamps = events.map((e) => new Date(e.occurred_at).getTime())
      expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1])
    })

    it('should respect the limit parameter', async () => {
      const identityValue = 'test_limit_' + Date.now()
      
      // Insert 5 events
      for (let i = 0; i < 5; i++) {
        const event: ProcessedEvent = {
          source: 'web',
          type: 'page.viewed',
          identity_type: 'anonymous_id',
          identity_value: identityValue,
          traits: { index: i },
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          raw: {},
        }
        await insertEvent(supabase, event)
      }

      // Retrieve with limit
      const events = await getEventsByIdentity(
        supabase,
        'anonymous_id',
        identityValue,
        3
      )

      expect(events.length).toBe(3)
    })

    it('should return empty array for non-existent identity', async () => {
      const events = await getEventsByIdentity(
        supabase,
        'anonymous_id',
        'nonexistent_identity_123456789',
        10
      )

      expect(events).toEqual([])
    })
  })

  describe('getEventsByType', () => {
    it('should retrieve events of a specific type', async () => {
      const uniqueType = 'test.event.' + Date.now()
      
      // Insert events of specific type
      const event: ProcessedEvent = {
        source: 'web',
        type: uniqueType,
        identity_type: 'anonymous_id',
        identity_value: 'test_' + Date.now(),
        traits: {},
        timestamp: new Date().toISOString(),
        raw: {},
      }

      await insertEvent(supabase, event)

      // Retrieve events
      const events = await getEventsByType(supabase, uniqueType, 10)

      expect(events.length).toBeGreaterThanOrEqual(1)
      expect(events[0].type).toBe(uniqueType)
    })

    it('should order events by occurred_at DESC', async () => {
      const uniqueType = 'test.ordered.' + Date.now()
      
      const event1: ProcessedEvent = {
        source: 'web',
        type: uniqueType,
        identity_type: 'anonymous_id',
        identity_value: 'user1',
        traits: {},
        timestamp: new Date(Date.now()).toISOString(),
        raw: {},
      }

      const event2: ProcessedEvent = {
        source: 'web',
        type: uniqueType,
        identity_type: 'anonymous_id',
        identity_value: 'user2',
        traits: {},
        timestamp: new Date(Date.now() + 2000).toISOString(),
        raw: {},
      }

      await insertEvent(supabase, event1)
      await insertEvent(supabase, event2)

      const events = await getEventsByType(supabase, uniqueType, 10)

      expect(events.length).toBeGreaterThanOrEqual(2)
      const timestamps = events.map((e) => new Date(e.occurred_at).getTime())
      expect(timestamps[0]).toBeGreaterThanOrEqual(timestamps[1])
    })
  })

  describe('Event Data Integrity', () => {
    it('should preserve all trait properties', async () => {
      const complexTraits = {
        string: 'test',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: {
          nested: {
            deeply: {
              value: 'deep',
            },
          },
        },
        unicode: '🎉 Test with emoji',
        special: 'Characters: <>&"\'',
      }

      const event: ProcessedEvent = {
        source: 'web',
        type: 'data.integrity.test',
        identity_type: 'anonymous_id',
        identity_value: 'test_' + Date.now(),
        traits: complexTraits,
        timestamp: new Date().toISOString(),
        raw: {},
      }

      const result = await insertEvent(supabase, event)

      expect(result.traits).toEqual(complexTraits)
    })

    it('should handle events with minimal data', async () => {
      const event: ProcessedEvent = {
        source: 'web',
        type: 'minimal.event',
        identity_type: 'anonymous_id',
        identity_value: 'test_' + Date.now(),
        traits: {},
        timestamp: new Date().toISOString(),
        raw: {},
      }

      const result = await insertEvent(supabase, event)

      expect(result).toBeDefined()
      expect(result.traits).toEqual({})
      expect(result.raw).toEqual({})
    })

    it('should handle events with large trait objects', async () => {
      const largeTraits = {
        ...Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`field_${i}`, `value_${i}`])
        ),
      }

      const event: ProcessedEvent = {
        source: 'web',
        type: 'large.traits.test',
        identity_type: 'anonymous_id',
        identity_value: 'test_' + Date.now(),
        traits: largeTraits,
        timestamp: new Date().toISOString(),
        raw: {},
      }

      const result = await insertEvent(supabase, event)

      expect(result.traits).toEqual(largeTraits)
      expect(Object.keys(result.traits || {}).length).toBe(50)
    })
  })
})
