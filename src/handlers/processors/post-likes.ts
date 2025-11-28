import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger, notifyEvent } from '../../lib/utils';
import { getSupabaseClient, upsertProfileFromEvent, insertEvent } from '../../lib/clients/supabase';
import { createTelegramClient } from '../../lib/clients';

/**
 * Handle post.liked and post.unliked events
 * FUNCTIONAL: Always saves likes/unlikes (core feature)
 * ANALYTICS: Only inserts to events table and sends notifications if user consented
 */
export async function processPostLike(event: ProcessedEvent, env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);
  const telegram = createTelegramClient(env);

  try {
    const traits = event.traits as Record<string, any>;
    const hasConsent = traits.hasConsent as boolean | undefined;

    // ANALYTICS: Only log the raw event if user consented
    // insertEvent now checks consent automatically and returns null if no consent
    const eventRecord = await insertEvent(supabase, event);
    if (eventRecord) {
      logger.debug('Post like event inserted into events table', { type: event.type, hasConsent });
    }

    // FUNCTIONAL: Ensure profile exists (Likes require a profile_id)
    const profile = await upsertProfileFromEvent(supabase, event);

    // FUNCTIONAL: Handle specific post like actions (always save)
    if (event.type === 'post.liked') {
      const { post_id } = traits;

      if (!post_id) {
        throw new Error('Missing required field for post.like: post_id');
      }

      const { error } = await supabase
        .from('post_likes')
        .insert({
          post_id,
          profile_id: profile.id,
          created_at: event.timestamp
        });

      if (error) throw error;
      logger.info('Post liked', { post_id, profile_id: profile.id, hasConsent });

      // ANALYTICS: Send Telegram notification only if consented
      if (hasConsent) {
        await notifyEvent(telegram, event, {
          emoji: '👍',
          title: 'New Post Like',
          includeUser: true,
          includePost: true  // Automatically extracts post_title and post_slug
        });
      }
    } else if (event.type === 'post.unliked') {
      const { post_id } = traits;
      
      if (!post_id) {
        throw new Error('Missing required field for post.unliked: post_id');
      }

      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post_id)
        .eq('profile_id', profile.id);

      if (error) throw error;
      logger.info('Post unliked', { post_id, profile_id: profile.id, hasConsent });

      // ANALYTICS: Send notification only if consented
      if (hasConsent) {
        await notifyEvent(telegram, event, {
          emoji: '👎',
          title: 'Post Unliked',
          includeUser: true,
          includePost: true  // Automatically extracts post_title and post_slug
        });
      }
    }

  } catch (error) {
    logger.error('Failed to process post like event', {
      type: event.type,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}