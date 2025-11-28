import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildWebProcessedEvent } from '../../src/lib/utils/events'
import type { WebEvent, ResolvedIdentity } from '../../src/schemas'

describe('Event Processing', () => {
  describe('buildWebProcessedEvent', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    const createIdentity = (overrides?: Partial<ResolvedIdentity>): ResolvedIdentity => ({
      identity_type: 'anonymous_id',
      identity_value: 'anon_123',
      anonymousId: 'anon_123',
      ...overrides,
    })

    it('should build a ProcessedEvent from a WebEvent with all required fields', () => {
      const webEvent: WebEvent = {
        name: 'page.viewed',
        context: {
          page: {
            path: '/blog/test-post',
            url: 'https://lucascosta.tech/blog/test-post',
            title: 'Test Post',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
      }

      const identity = createIdentity()
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result).toMatchObject({
        source: 'web',
        type: 'page.viewed',
        identity_type: 'anonymous_id',
        identity_value: 'anon_123',
        timestamp: expect.any(String),
      })
    })

    it('should include page context in traits', () => {
      const webEvent: WebEvent = {
        name: 'page.viewed',
        context: {
          page: {
            path: '/blog/my-awesome-post',
            url: 'https://lucascosta.tech/blog/my-awesome-post',
            title: 'My Awesome Post',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
      }

      const identity = createIdentity()
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result.traits).toMatchObject({
        page: {
          path: '/blog/my-awesome-post',
          url: 'https://lucascosta.tech/blog/my-awesome-post',
          title: 'My Awesome Post',
        },
        userAgent: 'Mozilla/5.0',
        locale: 'en-US',
      })
    })

    it('should use email identity when provided', () => {
      const webEvent: WebEvent = {
        name: 'newsletter.subscribed',
        context: {
          page: {
            path: '/subscribe',
            url: 'https://lucascosta.tech/subscribe',
            title: 'Subscribe',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
        user: {
          email: 'test@example.com',
          name: 'Test User',
        },
      }

      const identity = createIdentity({
        identity_type: 'email',
        identity_value: 'test@example.com',
      })
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result.identity_type).toBe('email')
      expect(result.identity_value).toBe('test@example.com')
      expect(result.traits?.user).toMatchObject({
        email: 'test@example.com',
        name: 'Test User',
      })
    })

    it('should include custom properties in traits', () => {
      const webEvent: WebEvent = {
        name: 'comment.created',
        context: {
          page: {
            path: '/blog/test-post',
            url: 'https://lucascosta.tech/blog/test-post',
            title: 'Test Post',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
        properties: {
          comment_id: 'comment_123',
          content: 'Great post!',
          parent_id: null,
        },
      }

      const identity = createIdentity()
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result.traits?.properties).toMatchObject({
        comment_id: 'comment_123',
        content: 'Great post!',
        parent_id: null,
      })
    })

    it('should include referrer information when provided', () => {
      const webEvent: WebEvent = {
        name: 'page.viewed',
        context: {
          page: {
            path: '/blog/test',
            url: 'https://lucascosta.tech/blog/test',
            title: 'Test',
            referrer: 'https://google.com/search?q=test',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
      }

      const identity = createIdentity()
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result.traits).toBeDefined()
      const traits = result.traits as any
      expect(traits.page?.referrer).toBe('https://google.com/search?q=test')
    })

    it('should store complete raw event data', () => {
      const webEvent: WebEvent = {
        name: 'post.liked',
        context: {
          page: {
            path: '/blog/test',
            url: 'https://lucascosta.tech/blog/test',
            title: 'Test',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
        properties: {
          post_id: 'post_123',
        },
      }

      const identity = createIdentity()
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result.raw).toEqual(webEvent)
    })

    it('should handle events without properties', () => {
      const webEvent: WebEvent = {
        name: 'page.viewed',
        context: {
          page: {
            path: '/',
            url: 'https://lucascosta.tech/',
            title: 'Home',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
      }

      const identity = createIdentity()
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result).toBeDefined()
      expect(result.traits).toBeDefined()
      expect(result.type).toBe('page.viewed')
      expect(result.traits?.properties).toEqual({})
    })

    it('should generate valid ISO timestamp', () => {
      const webEvent: WebEvent = {
        name: 'page.viewed',
        context: {
          page: {
            path: '/test',
            url: 'https://lucascosta.tech/test',
            title: 'Test',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
      }

      const identity = createIdentity()
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(() => new Date(result.timestamp)).not.toThrow()
    })

    it('should include anonymousId in context', () => {
      const webEvent: WebEvent = {
        name: 'page.viewed',
        context: {
          page: {
            path: '/test',
            url: 'https://lucascosta.tech/test',
            title: 'Test',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
      }

      const identity = createIdentity({ anonymousId: 'anon_xyz_789' })
      const result = buildWebProcessedEvent(webEvent, identity)

      const traits = result.traits as any
      expect(traits.context?.anonymousId).toBe('anon_xyz_789')
      expect(traits.anonymousId).toBe('anon_xyz_789')
    })

    it('should handle profile_id from magic link authentication', () => {
      const webEvent: WebEvent = {
        name: 'page.viewed',
        context: {
          page: {
            path: '/dashboard',
            url: 'https://lucascosta.tech/dashboard',
            title: 'Dashboard',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
        user: {
          profile_id: 'profile_uuid_123',
          email: 'user@example.com',
        },
      }

      const identity = createIdentity({
        identity_type: 'email',
        identity_value: 'user@example.com',
      })
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result.traits?.user).toMatchObject({
        profile_id: 'profile_uuid_123',
        email: 'user@example.com',
      })
    })

    it('should use custom timestamp when provided', () => {
      const customTimestamp = '2024-01-15T10:30:00.000Z'
      const webEvent: WebEvent = {
        name: 'page.viewed',
        context: {
          page: {
            path: '/test',
            url: 'https://lucascosta.tech/test',
            title: 'Test',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
        timestamp: customTimestamp,
      }

      const identity = createIdentity()
      const result = buildWebProcessedEvent(webEvent, identity)

      expect(result.timestamp).toBe(customTimestamp)
    })
  })

  describe('Event Type Validation', () => {
    const createIdentity = (): ResolvedIdentity => ({
      identity_type: 'anonymous_id',
      identity_value: 'anon_123',
      anonymousId: 'anon_123',
    })

    it('should accept valid event names', () => {
      const validEvents = [
        'page.viewed',
        'newsletter.subscribed',
        'comment.created',
        'post.liked',
        'contact.submitted',
      ]

      validEvents.forEach((eventName) => {
        const webEvent: WebEvent = {
          name: eventName,
          context: {
            page: {
              path: '/test',
              url: 'https://lucascosta.tech/test',
              title: 'Test',
            },
            userAgent: 'Mozilla/5.0',
            locale: 'en-US',
          },
        }

        const result = buildWebProcessedEvent(webEvent, createIdentity())
        expect(result.type).toBe(eventName)
      })
    })
  })

  describe('Traits Structure', () => {
    const createIdentity = (): ResolvedIdentity => ({
      identity_type: 'anonymous_id',
      identity_value: 'anon_123',
      anonymousId: 'anon_123',
    })

    it('should have nested context structure', () => {
      const webEvent: WebEvent = {
        name: 'page.viewed',
        context: {
          page: {
            path: '/blog/test',
            url: 'https://lucascosta.tech/blog/test',
            title: 'Test Post',
            referrer: 'https://twitter.com',
            search: '?utm_source=twitter',
          },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          locale: 'en-US',
        },
      }

      const result = buildWebProcessedEvent(webEvent, createIdentity())

      expect(result.traits?.context).toMatchObject({
        page: {
          path: '/blog/test',
          url: 'https://lucascosta.tech/blog/test',
          title: 'Test Post',
          referrer: 'https://twitter.com',
          search: '?utm_source=twitter',
        },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        locale: 'en-US',
        anonymousId: 'anon_123',
      })
    })

    it('should flatten fields for backward compatibility', () => {
      const webEvent: WebEvent = {
        name: 'post.liked',
        context: {
          page: {
            path: '/blog/my-post',
            url: 'https://lucascosta.tech/blog/my-post',
            title: 'My Post',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
        properties: {
          post_id: 'uuid-123',
          previous_state: 'unliked',
        },
      }

      const result = buildWebProcessedEvent(webEvent, createIdentity())

      // Should have both nested and flattened structure
      expect(result.traits?.properties).toMatchObject({
        post_id: 'uuid-123',
        previous_state: 'unliked',
      })
      expect(result.traits?.post_id).toBe('uuid-123')
      expect(result.traits?.previous_state).toBe('unliked')
    })

    it('should override with user fields in flattened structure', () => {
      const webEvent: WebEvent = {
        name: 'newsletter.subscribed',
        context: {
          page: {
            path: '/subscribe',
            url: 'https://lucascosta.tech/subscribe',
            title: 'Subscribe',
          },
          userAgent: 'Mozilla/5.0',
          locale: 'en-US',
        },
        properties: {
          email: 'wrong@example.com', // Should be overridden
        },
        user: {
          email: 'correct@example.com',
          name: 'Test User',
        },
      }

      const result = buildWebProcessedEvent(webEvent, createIdentity())

      // User fields should override properties in flattened structure
      expect(result.traits?.email).toBe('correct@example.com')
      expect(result.traits?.name).toBe('Test User')
    })
  })
})
