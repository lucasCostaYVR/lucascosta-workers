import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processPostLike } from '../../src/handlers/processors/post-likes'
import type { ProcessedEvent } from '../../src/schemas'
import type { Bindings } from '../../src/types'

// Mock the dependencies
vi.mock('../../src/lib/utils', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}))

vi.mock('../../src/lib/clients', () => ({
  createTelegramClient: vi.fn(() => null),
}))

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
}

const mockInsertEvent = vi.fn()
const mockUpsertProfile = vi.fn()

vi.mock('../../src/lib/clients/supabase', () => ({
  getSupabaseClient: vi.fn(() => mockSupabaseClient),
  insertEvent: () => mockInsertEvent(),
  upsertProfileFromEvent: () => mockUpsertProfile(),
}))

describe('processPostLike', () => {
  const mockEnv: Bindings = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_KEY: 'test-key',
  } as Bindings

  const mockProfile = {
    id: 'profile-123',
    email: 'test@example.com',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUpsertProfile.mockResolvedValue(mockProfile)
    mockInsertEvent.mockResolvedValue(undefined)
  })

  describe('post.liked', () => {
    it('should insert a like into post_likes table', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      })

      const event: ProcessedEvent = {
        source: 'web',
        type: 'post.liked',
        identity_type: 'email',
        identity_value: 'user@example.com',
        traits: {
          post_id: 'post-456',
        },
        timestamp: '2024-01-01T00:00:00Z',
        raw: {},
      }

      await processPostLike(event, mockEnv)

      // Verify Supabase operations
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('post_likes')
      expect(mockInsert).toHaveBeenCalledWith({
        post_id: 'post-456',
        profile_id: 'profile-123',
        created_at: '2024-01-01T00:00:00Z',
      })
    })

    it('should throw error if post_id is missing', async () => {
      const event: ProcessedEvent = {
        source: 'web',
        type: 'post.liked',
        identity_type: 'email',
        identity_value: 'user@example.com',
        traits: {}, // Missing post_id
        timestamp: '2024-01-01T00:00:00Z',
        raw: {},
      }

      await expect(processPostLike(event, mockEnv)).rejects.toThrow(
        'Missing required field for post.like: post_id'
      )
    })

    it('should handle Supabase errors gracefully', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        error: { message: 'Database error' },
      })

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      })

      const event: ProcessedEvent = {
        source: 'web',
        type: 'post.liked',
        identity_type: 'email',
        identity_value: 'user@example.com',
        traits: {
          post_id: 'post-456',
        },
        timestamp: '2024-01-01T00:00:00Z',
        raw: {},
      }

      await expect(processPostLike(event, mockEnv)).rejects.toThrow()
    })
  })

  describe('post.unliked', () => {
    it('should delete a like from post_likes table', async () => {
      const mockEq = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          error: null,
        }),
      })

      const mockDelete = vi.fn().mockReturnValue({
        eq: mockEq,
      })

      mockSupabaseClient.from.mockReturnValue({
        delete: mockDelete,
      })

      const event: ProcessedEvent = {
        source: 'web',
        type: 'post.unliked',
        identity_type: 'email',
        identity_value: 'user@example.com',
        traits: {
          post_id: 'post-456',
        },
        timestamp: '2024-01-01T00:00:00Z',
        raw: {},
      }

      await processPostLike(event, mockEnv)

      // Verify Supabase operations
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('post_likes')
      expect(mockDelete).toHaveBeenCalled()
    })

    it('should throw error if post_id is missing', async () => {
      const event: ProcessedEvent = {
        source: 'web',
        type: 'post.unliked',
        identity_type: 'email',
        identity_value: 'user@example.com',
        traits: {}, // Missing post_id
        timestamp: '2024-01-01T00:00:00Z',
        raw: {},
      }

      await expect(processPostLike(event, mockEnv)).rejects.toThrow(
        'Missing required field for post.unliked: post_id'
      )
    })
  })

  describe('profile resolution', () => {
    it('should create/update profile from event', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        error: null,
      })

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      })

      const event: ProcessedEvent = {
        source: 'web',
        type: 'post.liked',
        identity_type: 'email',
        identity_value: 'newuser@example.com',
        traits: {
          post_id: 'post-789',
          name: 'New User',
        },
        timestamp: '2024-01-01T00:00:00Z',
        raw: {},
      }

      await processPostLike(event, mockEnv)

      // Verify profile was resolved
      expect(mockUpsertProfile).toHaveBeenCalled()
    })
  })
})
