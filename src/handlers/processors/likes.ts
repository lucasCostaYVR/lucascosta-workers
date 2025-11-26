import { Bindings } from '../../types';
import { createClient } from '@supabase/supabase-js';
import type { ProcessedEvent } from '../../schemas';

/**
 * Handle post.liked event
 * 
 * Frontend sends WebEvent:
 * {
 *   name: 'post.liked',
 *   context: {
 *     page: { path: '/blog/my-post', url: '...', title: '...' },
 *     userAgent: '...',
 *     locale: 'en-US'
 *   },
 *   properties: {
 *     post_id: 'uuid',
 *     post_slug: 'my-post',
 *     post_title: 'My Post'
 *   },
 *   user: { email: 'user@example.com' } // optional
 * }
 * 
 * Worker transforms to ProcessedEvent (what we receive here):
 * {
 *   type: 'post.liked',
 *   source: 'web',
 *   identity_type: 'email' | 'anonymous_id',
 *   identity_value: 'user@example.com' | 'anon_xyz',
 *   traits: {
 *     post_id: 'uuid',        // from properties
 *     post_slug: 'my-post',   // from properties
 *     post_title: 'My Post',  // from properties
 *     path: '/blog/my-post',  // from context.page
 *     anonymousId: 'anon_xyz',
 *     ...
 *   }
 * }
 */

export async function processPostLike(
  event: ProcessedEvent,
  env: Bindings
): Promise<{ success: boolean; already_liked?: boolean; like_count?: number }> {
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

  const { identity_type, identity_value, traits } = event;

  // Extract post info from traits (properties get spread into traits)
  const post_id = traits.post_id as string;
  if (!post_id) {
    throw new Error('post_id required in properties');
  }

  // 1. Get or create profile for this identity
  let profileId: string;

  if (identity_type === 'anonymous_id') {
    const { data, error } = await db
      .rpc('get_or_create_profile_by_anonymous_id', { p_anonymous_id: identity_value })
      .single();

    if (error) {
      console.error('Failed to get/create anonymous profile:', error);
      throw new Error('Failed to process like');
    }

    profileId = data as string;
  } else if (identity_type === 'email') {
    // For email, we need to check if profile exists or create one
    const { data: existingProfile } = await db
      .from('profiles')
      .select('id')
      .eq('email', identity_value)
      .single();

    if (existingProfile) {
      profileId = existingProfile.id;
    } else {
      // Create new profile with email
      const { data: newProfile, error } = await db
        .from('profiles')
        .insert({ email: identity_value, status: 'free' })
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create email profile:', error);
        throw new Error('Failed to process like');
      }

      profileId = newProfile.id;

      // Add email to identity_graph
      await db
        .from('identity_graph')
        .insert({
          profile_id: profileId,
          identity_type: 'email',
          identity_value,
        });
    }
  } else {
    throw new Error(`Unsupported identity_type: ${identity_type}`);
  }

  // 2. Check if post exists
  const { data: post, error: postError } = await db
    .from('posts')
    .select('id, like_count')
    .eq('id', post_id)
    .single();

  if (postError || !post) {
    console.error('Post not found:', post_id);
    throw new Error('Post not found');
  }

  // 3. Try to insert like (will fail if already liked due to unique constraint)
  const { data: like, error: likeError } = await db
    .from('post_likes')
    .insert({
      post_id,
      profile_id: profileId,
      identity_type,
      identity_value,
    })
    .select('id')
    .single();

  if (likeError) {
    // Check if it's a duplicate constraint violation
    if (likeError.code === '23505') {
      // Already liked - return success with flag
      return {
        success: true,
        already_liked: true,
        like_count: post.like_count,
      };
    }

    console.error('Failed to insert like:', likeError);
    throw new Error('Failed to process like');
  }

  // 4. Get updated like count (trigger will have incremented it)
  const { data: updatedPost } = await db
    .from('posts')
    .select('like_count')
    .eq('id', post_id)
    .single();

  return {
    success: true,
    already_liked: false,
    like_count: updatedPost?.like_count || post.like_count + 1,
  };
}

/**
 * Handle post.unliked event (optional - for future)
 */
export async function processPostUnlike(
  event: ProcessedEvent,
  env: Bindings
): Promise<{ success: boolean; like_count?: number }> {
  const db = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

  const { identity_type, identity_value, traits } = event;

  const post_id = traits.post_id as string;
  if (!post_id) {
    throw new Error('post_id required in properties');
  }

  // Find the like and delete it
  const { error } = await db
    .from('post_likes')
    .delete()
    .match({
      post_id,
      identity_type,
      identity_value,
    });

  if (error) {
    console.error('Failed to unlike post:', error);
    throw new Error('Failed to unlike post');
  }

  // Get updated like count
  const { data: post } = await db
    .from('posts')
    .select('like_count')
    .eq('id', post_id)
    .single();

  return {
    success: true,
    like_count: post?.like_count || 0,
  };
}
