import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  getOrCreateProfileByAnonymousId,
  mergeAnonymousToEmail,
  getProfileByIdentity,
  getIdentitiesForProfile,
  linkAnonymousToProfileId,
} from '../../src/lib/db/identity-graph'
import dotenv from 'dotenv'

dotenv.config({ path: '.dev.vars' })

// Integration tests - These require a real Supabase connection
describe('Identity Graph Operations', () => {
  let supabase: ReturnType<typeof createClient>

  beforeAll(() => {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_KEY

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables')
    }

    supabase = createClient(supabaseUrl, supabaseKey)
  })

  describe('getOrCreateProfileByAnonymousId', () => {
    it('should create a new profile for unknown anonymous ID', async () => {
      const anonymousId = 'test_anon_' + Date.now()

      const profileId = await getOrCreateProfileByAnonymousId(
        supabase,
        anonymousId
      )

      expect(profileId).toBeDefined()
      expect(typeof profileId).toBe('string')
      expect(profileId.length).toBe(36) // UUID format
    })

    it('should return same profile ID for existing anonymous ID', async () => {
      const anonymousId = 'test_anon_idempotent_' + Date.now()

      const profileId1 = await getOrCreateProfileByAnonymousId(
        supabase,
        anonymousId
      )

      const profileId2 = await getOrCreateProfileByAnonymousId(
        supabase,
        anonymousId
      )

      expect(profileId1).toBe(profileId2)
    })

    it('should create profile entry in identity_graph', async () => {
      const anonymousId = 'test_anon_graph_' + Date.now()

      const profileId = await getOrCreateProfileByAnonymousId(
        supabase,
        anonymousId
      )

      // Verify identity_graph entry
      const { data: identity } = await supabase
        .from('identity_graph')
        .select('*')
        .eq('identity_type', 'anonymous_id')
        .eq('identity_value', anonymousId)
        .single()

      expect(identity).toBeDefined()
      expect(identity?.profile_id).toBe(profileId)
    })
  })

  describe('mergeAnonymousToEmail', () => {
    it('should upgrade anonymous profile with email', async () => {
      const anonymousId = 'test_anon_upgrade_' + Date.now()
      const email = 'upgrade_' + Date.now() + '@example.com'

      // Create anonymous profile first
      const anonProfileId = await getOrCreateProfileByAnonymousId(
        supabase,
        anonymousId
      )

      // Subscribe with email (this is effectively a "merge" in the function logic)
      const result = await mergeAnonymousToEmail(
        supabase,
        email,
        anonymousId,
        { name: 'Test User', status: 'subscribed' }
      )

      expect(result.profile_id).toBe(anonProfileId)
      expect(result.was_new_profile).toBe(false)
      // When upgrading anonymous profile with email, was_merged is true
      // because the function internally "merges" the identities

      // Verify email identity was added
      const { data: emailIdentity } = await supabase
        .from('identity_graph')
        .select('*')
        .eq('identity_type', 'email')
        .eq('identity_value', email)
        .single()

      expect((emailIdentity as any)?.profile_id).toBe(anonProfileId)
    })

    it('should link existing email profile to new anonymous ID', async () => {
      const email = 'existing_' + Date.now() + '@example.com'
      const anonymousId1 = 'test_anon1_' + Date.now()
      const anonymousId2 = 'test_anon2_' + Date.now()

      // Create email profile with first anonymous ID
      const result1 = await mergeAnonymousToEmail(
        supabase,
        email,
        anonymousId1
      )

      // Link second anonymous ID to same email
      const result2 = await mergeAnonymousToEmail(
        supabase,
        email,
        anonymousId2
      )

      expect(result2.profile_id).toBe(result1.profile_id)
      expect(result2.was_new_profile).toBe(false)

      // Verify both anonymous IDs linked to same profile
      const identities = await getIdentitiesForProfile(
        supabase,
        result1.profile_id
      )

      const anonIdentities = identities.filter(
        (i: any) => i.identity_type === 'anonymous_id'
      )
      expect(anonIdentities.length).toBe(2)
    })

    it('should merge two separate profiles', async () => {
      const email = 'merge_test_' + Date.now() + '@example.com'
      const anonymousId = 'test_anon_merge_' + Date.now()

      // Create anonymous profile first
      await getOrCreateProfileByAnonymousId(supabase, anonymousId)

      // Create separate email profile via direct insert
      const { data: emailProfile } = await supabase
        .from('profiles')
        .insert({
          email,
          name: 'Email User',
        })
        .select('id')
        .single()

      // Add email identity to identity_graph
      await supabase.from('identity_graph').insert({
        profile_id: emailProfile!.id,
        identity_type: 'email',
        identity_value: email,
      })

      // Now merge them
      const result = await mergeAnonymousToEmail(
        supabase,
        email,
        anonymousId
      )

      expect(result.was_merged).toBe(true)
      expect(result.profile_id).toBe(emailProfile!.id)

      // Verify anonymous ID now points to email profile
      const anonProfileId = await getProfileByIdentity(
        supabase,
        'anonymous_id',
        anonymousId
      )
      expect(anonProfileId).toBe(emailProfile!.id)
    })

    it('should handle metadata parameters', async () => {
      const email = 'metadata_test_' + Date.now() + '@example.com'
      const anonymousId = 'test_anon_metadata_' + Date.now()

      const result = await mergeAnonymousToEmail(
        supabase,
        email,
        anonymousId,
        {
          name: 'John Doe',
          status: 'subscribed',
        }
      )

      // Verify profile has metadata
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', result.profile_id)
        .single()

      expect(profile?.email).toBe(email)
      expect(profile?.name).toBe('John Doe')
      expect(profile?.status).toBe('subscribed')
    })
  })

  describe('getProfileByIdentity', () => {
    it('should get profile by email', async () => {
      const email = 'find_by_email_' + Date.now() + '@example.com'
      const anonymousId = 'test_anon_find_' + Date.now()

      const originalProfileId = await mergeAnonymousToEmail(
        supabase,
        email,
        anonymousId
      ).then((r) => r.profile_id)

      const foundProfileId = await getProfileByIdentity(
        supabase,
        'email',
        email
      )

      expect(foundProfileId).toBe(originalProfileId)
    })

    it('should get profile by anonymous_id', async () => {
      const anonymousId = 'find_by_anon_' + Date.now()

      const originalProfileId = await getOrCreateProfileByAnonymousId(
        supabase,
        anonymousId
      )

      const foundProfileId = await getProfileByIdentity(
        supabase,
        'anonymous_id',
        anonymousId
      )

      expect(foundProfileId).toBe(originalProfileId)
    })

    it('should return null for non-existent identity', async () => {
      const profileId = await getProfileByIdentity(
        supabase,
        'email',
        'nonexistent_' + Date.now() + '@example.com'
      )

      expect(profileId).toBeNull()
    })

    it('should update last_seen timestamp', async () => {
      const anonymousId = 'last_seen_test_' + Date.now()

      await getOrCreateProfileByAnonymousId(supabase, anonymousId)

      // Get initial timestamp
      const { data: before } = await supabase
        .from('identity_graph')
        .select('last_seen_at')
        .eq('identity_value', anonymousId)
        .single()

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Call getProfileByIdentity (should update timestamp)
      await getProfileByIdentity(supabase, 'anonymous_id', anonymousId)

      // Get updated timestamp
      const { data: after } = await supabase
        .from('identity_graph')
        .select('last_seen_at')
        .eq('identity_value', anonymousId)
        .single()

      expect(new Date(after!.last_seen_at).getTime()).toBeGreaterThan(
        new Date(before!.last_seen_at).getTime()
      )
    })
  })

  describe('getIdentitiesForProfile', () => {
    it('should return all identities for a profile', async () => {
      const email = 'identities_test_' + Date.now() + '@example.com'
      const anonymousId = 'test_anon_identities_' + Date.now()

      const profileId = await mergeAnonymousToEmail(
        supabase,
        email,
        anonymousId
      ).then((r) => r.profile_id)

      const identities = await getIdentitiesForProfile(supabase, profileId)

      expect(identities.length).toBeGreaterThanOrEqual(2)

      const types = identities.map((i: any) => i.identity_type)
      expect(types).toContain('email')
      expect(types).toContain('anonymous_id')

      const emailIdentity = identities.find(
        (i: any) => i.identity_type === 'email'
      )
      expect(emailIdentity?.identity_value).toBe(email)

      const anonIdentity = identities.find(
        (i: any) => i.identity_type === 'anonymous_id'
      )
      expect(anonIdentity?.identity_value).toBe(anonymousId)
    })

    it('should return empty array for non-existent profile', async () => {
      const identities = await getIdentitiesForProfile(
        supabase,
        '00000000-0000-0000-0000-000000000000'
      )

      expect(identities).toEqual([])
    })

    it('should include timestamps', async () => {
      const anonymousId = 'timestamps_test_' + Date.now()

      const profileId = await getOrCreateProfileByAnonymousId(
        supabase,
        anonymousId
      )

      const identities = await getIdentitiesForProfile(supabase, profileId)

      expect(identities.length).toBeGreaterThan(0)
      expect(identities[0].first_seen_at).toBeDefined()
      expect(identities[0].last_seen_at).toBeDefined()
    })
  })

  describe('linkAnonymousToProfileId', () => {
    it('should link anonymous ID to existing profile', async () => {
      const email = 'link_test_' + Date.now() + '@example.com'
      const anonymousId1 = 'test_anon_link1_' + Date.now()
      const anonymousId2 = 'test_anon_link2_' + Date.now()

      // Create profile with first anonymous ID
      const profileId = await mergeAnonymousToEmail(
        supabase,
        email,
        anonymousId1
      ).then((r) => r.profile_id)

      // Link second anonymous ID directly
      await linkAnonymousToProfileId(supabase, profileId, anonymousId2)

      // Verify second anonymous ID now points to same profile
      const linkedProfileId = await getProfileByIdentity(
        supabase,
        'anonymous_id',
        anonymousId2
      )

      expect(linkedProfileId).toBe(profileId)
    })

    it('should handle duplicate links gracefully', async () => {
      const anonymousId = 'duplicate_link_' + Date.now()

      const profileId = await getOrCreateProfileByAnonymousId(
        supabase,
        anonymousId
      )

      // Try to link again (should not error due to upsert)
      await linkAnonymousToProfileId(supabase, profileId, anonymousId)

      // Verify still works
      const foundProfileId = await getProfileByIdentity(
        supabase,
        'anonymous_id',
        anonymousId
      )

      expect(foundProfileId).toBe(profileId)
    })

    it('should update last_seen timestamp on duplicate link', async () => {
      const anonymousId = 'last_seen_link_' + Date.now()

      const profileId = await getOrCreateProfileByAnonymousId(
        supabase,
        anonymousId
      )

      // Get initial timestamp
      const { data: before } = await supabase
        .from('identity_graph')
        .select('last_seen_at')
        .eq('identity_value', anonymousId)
        .single()

      await new Promise((resolve) => setTimeout(resolve, 100))

      // Link again
      await linkAnonymousToProfileId(supabase, profileId, anonymousId)

      // Get updated timestamp
      const { data: after } = await supabase
        .from('identity_graph')
        .select('last_seen_at')
        .eq('identity_value', anonymousId)
        .single()

      expect(new Date(after!.last_seen_at).getTime()).toBeGreaterThan(
        new Date(before!.last_seen_at).getTime()
      )
    })
  })

  describe('Cross-Session Identity Resolution', () => {
    it('should maintain identity across sessions with magic link', async () => {
      const anon1 = 'cross_session_anon1_' + Date.now()
      const anon2 = 'cross_session_anon2_' + Date.now()
      const email = 'cross_session_' + Date.now() + '@example.com'

      // Session 1: Anonymous user browses
      const session1ProfileId = await getOrCreateProfileByAnonymousId(
        supabase,
        anon1
      )

      // User subscribes with email
      const subscribed = await mergeAnonymousToEmail(supabase, email, anon1)

      expect(subscribed.profile_id).toBe(session1ProfileId)

      // Session 2: User clicks magic link on different device
      // Magic link contains profile_id, new device has new anonymous_id
      await linkAnonymousToProfileId(supabase, subscribed.profile_id, anon2)

      // Verify both anonymous IDs now linked to same profile
      const identities = await getIdentitiesForProfile(
        supabase,
        subscribed.profile_id
      )

      const values = identities.map((i: any) => i.identity_value)
      expect(values).toContain(anon1)
      expect(values).toContain(anon2)
      expect(values).toContain(email)

      // Verify all three identity types can resolve to same profile
      const profileByAnon1 = await getProfileByIdentity(
        supabase,
        'anonymous_id',
        anon1
      )
      const profileByAnon2 = await getProfileByIdentity(
        supabase,
        'anonymous_id',
        anon2
      )
      const profileByEmail = await getProfileByIdentity(
        supabase,
        'email',
        email
      )

      expect(profileByAnon1).toBe(subscribed.profile_id)
      expect(profileByAnon2).toBe(subscribed.profile_id)
      expect(profileByEmail).toBe(subscribed.profile_id)
    })
  })
})
