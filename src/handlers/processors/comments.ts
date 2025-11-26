import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import { getSupabaseClient, upsertProfileFromEvent, insertEvent } from '../../lib/clients/supabase';
import { createTelegramClient } from '../../lib/clients';

export async function processComment(event: ProcessedEvent, env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);
  const telegram = createTelegramClient(env);

  try {
    // 1. Always log the raw event first
    await insertEvent(supabase, event);
    logger.debug('Comment event inserted into events table', { type: event.type });

    // 2. Ensure profile exists (Comments require a profile_id)
    // We use the event identity (email) to find/create the profile
    const profile = await upsertProfileFromEvent(supabase, event);
    
    const traits = event.traits as Record<string, any>;

    // 3. Handle specific comment actions
    if (event.type === 'comment.created') {
      const { post_id, parent_comment_id, content } = traits;

      if (!post_id || !content) {
        throw new Error('Missing required fields for comment.created: post_id, content');
      }

      const { error } = await supabase
        .from('comments')
        .insert({
          post_id,
          profile_id: profile.id,
          parent_comment_id: parent_comment_id || null,
          content,
          created_at: event.timestamp,
          updated_at: event.timestamp
        });

      if (error) throw error;
      logger.info('Comment created', { post_id, profile_id: profile.id });

      // Send Telegram notification for new comments
      if (telegram) {
        try {
          const contentPreview = content.length > 100 ? content.substring(0, 100) + '...' : content;
          await telegram.notify('💬', 'New Comment', {
            'Author': event.identity_value,
            'Post ID': post_id,
            'Preview': contentPreview,
            'Reply to': parent_comment_id ? `Comment ${parent_comment_id}` : 'Post'
          });
        } catch (telegramError) {
          logger.error('Failed to send Telegram notification', {
            error: telegramError instanceof Error ? telegramError.message : String(telegramError)
          });
        }
      }

    } else if (event.type === 'comment.updated') {
      const { comment_id, content } = traits;

      if (!comment_id || !content) {
        throw new Error('Missing required fields for comment.updated: comment_id, content');
      }

      // Verify ownership (optional but good practice, though RLS usually handles this in Supabase)
      // For a worker, we are admin, so we should be careful. 
      // We assume the upstream server action verified the user's permission to edit this comment.
      
      const { error } = await supabase
        .from('comments')
        .update({
          content,
          is_edited: true,
          updated_at: event.timestamp
        })
        .eq('id', comment_id)
        .eq('profile_id', profile.id); // Ensure user owns the comment

      if (error) throw error;
      logger.info('Comment updated', { comment_id, profile_id: profile.id });

    } else if (event.type === 'comment.deleted') {
      const { comment_id } = traits;

      if (!comment_id) {
        throw new Error('Missing required fields for comment.deleted: comment_id');
      }

      const { error } = await supabase
        .from('comments')
        .update({
          is_deleted: true,
          updated_at: event.timestamp
        })
        .eq('id', comment_id)
        .eq('profile_id', profile.id); // Ensure user owns the comment

      if (error) throw error;
      logger.info('Comment soft-deleted', { comment_id, profile_id: profile.id });
    }

  } catch (error) {
    logger.error('Failed to process comment event', {
      type: event.type,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
