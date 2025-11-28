import type { ProcessedEvent } from '../../schemas';
import type { Bindings } from '../../types';
import { createLogger, notifyEvent } from '../../lib/utils';
import { getSupabaseClient, upsertProfileFromEvent } from '../../lib/clients/supabase';
import { createTelegramClient } from '../../lib/clients';

/**
 * Handle snippet.viewed events
 * No database writes - just telemetry in events table
 */
export async function processSnippetView(
  event: ProcessedEvent,
  env: Bindings
): Promise<void> {
  const logger = createLogger(env);
  
  const traits = event.traits as Record<string, any>;
  const snippetId = traits.snippet_id;
  
  if (!snippetId) {
    throw new Error('snippet_id is required for snippet.viewed event');
  }

  // Event is already in events table via insertEvent()
  logger.info('Snippet view recorded', { snippetId });
}

/**
 * Handle snippet.liked and snippet.unliked events
 * FUNCTIONAL: Always saves likes/unlikes (core feature)
 * ANALYTICS: Only sends notifications if user consented
 */
export async function processSnippetLike(
  event: ProcessedEvent,
  env: Bindings
): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);
  const telegram = createTelegramClient(env);

  try {
    const traits = event.traits as Record<string, any>;
    const snippetId = traits.snippet_id;
    const hasConsent = traits.hasConsent as boolean | undefined;
    
    if (!snippetId) {
      throw new Error('snippet_id is required for snippet.liked/unliked event');
    }

    // FUNCTIONAL: Resolve profile (always needed)
    const profile = await upsertProfileFromEvent(supabase, event);

  if (event.type === 'snippet.liked') {
    // FUNCTIONAL: Insert like (trigger updates count automatically)
    // This is a core feature - user expects their likes to persist
    const { error } = await supabase
      .from('snippet_likes')
      .insert({
        snippet_id: snippetId,
        profile_id: profile.id
      });

    if (error && !error.message.includes('duplicate key')) {
      throw error;
    }

    logger.info('Snippet like recorded', { snippetId, profileId: profile.id, hasConsent });

    // ANALYTICS: Only notify if user consented to tracking
    if (hasConsent) {
      await notifyEvent(telegram, event, {
        emoji: '👍',
        title: 'Snippet Liked',
        includeUser: true,
        customFields: (evt) => {
          const t = evt.traits as Record<string, any>;
          return {
            'Snippet ID': snippetId,
            'Category': t.category || 'Unknown',
            'Snippet Title': t.snippet_title || 'Unknown'
          };
        }
      });
    }

  } else if (event.type === 'snippet.unliked') {
    // FUNCTIONAL: Delete like (trigger updates count automatically)
    const { error } = await supabase
      .from('snippet_likes')
      .delete()
      .eq('snippet_id', snippetId)
      .eq('profile_id', profile.id);

    if (error) {
      throw error;
    }

    logger.info('Snippet unlike recorded', { snippetId, profileId: profile.id, hasConsent });
  }
  } catch (error) {
    logger.error('Failed to process snippet like', {
      type: event.type,
      error: error instanceof Error ? error.message : JSON.stringify(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Handle snippet.copied events
 * FUNCTIONAL: Always saves copies (core feature)
 * ANALYTICS: Only sends notifications if user consented
 */
export async function processSnippetCopy(
  event: ProcessedEvent,
  env: Bindings
): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);
  const telegram = createTelegramClient(env);

  const traits = event.traits as Record<string, any>;
  const snippetId = traits.snippet_id;
  const hasConsent = traits.hasConsent as boolean | undefined;
  
  if (!snippetId) {
    throw new Error('snippet_id is required for snippet.copied event');
  }

  // FUNCTIONAL: Resolve profile (always needed)
  const profile = await upsertProfileFromEvent(supabase, event);

  // FUNCTIONAL: Insert copy (trigger updates count automatically)
  // This is a core feature - tracking code usage
  const { error } = await supabase
    .from('snippet_copies')
    .insert({
      snippet_id: snippetId,
      profile_id: profile.id,
      copied_at: event.timestamp
    });

  if (error) {
    throw error;
  }

  logger.info('Snippet copy recorded', { snippetId, profileId: profile.id, hasConsent });

  // ANALYTICS: Only notify if user consented to tracking
  if (hasConsent) {
    await notifyEvent(telegram, event, {
      emoji: '📋',
      title: 'Snippet Copied',
      includeUser: true,
      customFields: (evt) => {
        const t = evt.traits as Record<string, any>;
        return {
          'Snippet ID': snippetId,
          'Category': t.category || 'Unknown',
          'Snippet Title': t.snippet_title || 'Unknown'
        };
      }
    });
  }
}

/**
 * Handle snippet.searched events
 * PURE ANALYTICS: Only processes if user consented
 * Search tracking is not essential - it's purely for understanding user behavior
 */
export async function processSnippetSearch(
  event: ProcessedEvent,
  env: Bindings
): Promise<void> {
  const logger = createLogger(env);
  const telegram = createTelegramClient(env);

  const traits = event.traits as Record<string, any>;
  const query = traits.query;
  const resultCount = traits.result_count;
  const hasConsent = traits.hasConsent as boolean | undefined;
  
  if (!query) {
    throw new Error('query is required for snippet.searched event');
  }

  // ANALYTICS: Skip entirely if no consent (pure analytics event)
  if (!hasConsent) {
    logger.info('Snippet search skipped (no consent)', { query, resultCount });
    return;
  }

  // Event was already inserted into events table via insertEvent()
  logger.info('Snippet search recorded', { query, resultCount, hasConsent });

  // Notify on search (user behavior insights)
  await notifyEvent(telegram, event, {
    emoji: '🔍',
    title: 'Snippet Search',
    includeUser: true,
    customFields: (evt) => {
      const t = evt.traits as Record<string, any>;
      return {
        'Query': t.query,
        'Results': t.result_count !== undefined ? String(t.result_count) : 'Unknown',
        'No Results': t.result_count === 0 ? '⚠️ Yes' : 'No'
      };
    }
  });
}
