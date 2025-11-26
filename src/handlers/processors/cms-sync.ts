import type { Message } from '@cloudflare/workers-types';
import type { Bindings } from '../../types';
import type { CmsJob } from '../../schemas';
import { createLogger } from '../../lib/utils';
import { getSupabaseClient } from '../../lib/clients/supabase';
import { NotionClient } from '../../lib/clients';
import { insertEvent, reconcilePostTags } from '../../lib/clients/supabase';
import { getDataSource, resolveNotionDatabaseId } from '../../lib/utils';
import { createTelegramClient } from '../../lib/clients';

export async function processCmsSync(
  message: Message<CmsJob>,
  env: Bindings
): Promise<void> {
  const logger = createLogger(env);
  const job = message.body;

  logger.info('Processing CMS job', { action: job.action });

  try {
    if (job.action === 'import') {
      await handleImport(job, env, logger);
    } else if (job.action === 'export') {
      await handleExport(job, env, logger);
    } else if (job.action === 'update') {
      await handleUpdate(job, env, logger);
    }

    message.ack();

  } catch (error) {
    logger.error('Failed to process CMS job', {
      action: job.action,
      error: error instanceof Error ? error.message : String(error)
    });
    message.retry();
  }
}

// IMPORT: Notion → Supabase
async function handleImport(job: Extract<CmsJob, { action: 'import' }>, env: Bindings, logger: any) {
  const source = getDataSource(job.sourceKey);
  if (!source) throw new Error(`Unknown source: ${job.sourceKey}`);

  const supabase = getSupabaseClient(env);
  const notion = new NotionClient(env.NOTION_API_KEY, env.ASSETS_BUCKET);
  const telegram = createTelegramClient(env);
  const databaseId = resolveNotionDatabaseId(source, env);

  if (job.pageId) {
    // Sync Single Page (notification handled inside syncSinglePage)
    await syncSinglePage(job.pageId, notion, supabase, logger, telegram);
  } else {
    // Sync All Pages
    const posts = await notion.getAllPosts(databaseId);
    for (const post of posts) {
      await upsertPost(post, supabase);
    }
    logger.info('Synced all posts', { count: posts.length });
    
    // Send notification for bulk sync
    if (telegram) {
      try {
        await telegram.notify('🔄', 'Bulk Post Sync Complete', {
          'Source': job.sourceKey,
          'Posts Synced': String(posts.length)
        });
      } catch (error) {
        logger.error('Failed to send Telegram notification', { error });
      }
    }
  }
}

// EXPORT: Supabase → Notion
async function handleExport(job: Extract<CmsJob, { action: 'export' }>, env: Bindings, logger: any) {
  const source = getDataSource(job.sourceKey);
  if (!source || !source.supabaseView) {
    throw new Error(`Source ${job.sourceKey} has no Supabase view configured`);
  }

  const supabase = getSupabaseClient(env);
  const notion = new NotionClient(env.NOTION_API_KEY, env.ASSETS_BUCKET);
  const telegram = createTelegramClient(env);
  const databaseId = resolveNotionDatabaseId(source, env);

  logger.info('Export to Notion', { view: source.supabaseView, sourceKey: job.sourceKey });

  // 1. Query the Supabase view
  const { data, error } = await supabase
    .from(source.supabaseView)
    .select('*')
    .limit(job.batchSize);

  if (error) {
    throw new Error(`Failed to query ${source.supabaseView}: ${error.message}`);
  }

  if (!data || data.length === 0) {
    logger.info('No data to export', { view: source.supabaseView });
    return;
  }

  logger.info('Fetched data from Supabase', { view: source.supabaseView, rows: data.length });

  // 2. Transform and upsert pages in Notion
  const config = getTransformerConfig(job.sourceKey);
  let created = 0;
  let updated = 0;
  
  for (const row of data) {
    const properties = config.transformer(row);
    const shouldUpdate = config.shouldUpdate ? config.shouldUpdate(row) : false;

    if (shouldUpdate) {
      // Update existing page (e.g., "Last 7 Days" rolling window)
      const existingPage = await notion.queryDatabaseByProperty(
        databaseId,
        config.uniqueKey,
        properties[config.uniqueKey]
      );

      if (existingPage) {
        await notion.updatePage(existingPage.id, properties);
        logger.info('Updated Notion page', { pageId: existingPage.id });
        updated++;
      } else {
        await notion.createPage(databaseId, properties);
        logger.info('Created Notion page (expected existing)', { key: config.uniqueKey });
        created++;
      }
    } else {
      // Create new page (e.g., weekly snapshot)
      await notion.createPage(databaseId, properties);
      logger.info('Created Notion page', { key: config.uniqueKey });
      created++;
    }
  }

  logger.info('Successfully exported to Notion', { 
    sourceKey: job.sourceKey, 
    rows: data.length,
    created,
    updated
  });

  // Analytics sync notifications removed - replaced with daily summary
}

/**
 * Get the transformer config for a data source
 */
function getTransformerConfig(sourceKey: string): {
  transformer: (row: any) => any;
  uniqueKey: string;
  shouldUpdate?: (row: any) => boolean;
} {
  const configs: Record<string, any> = {
    'WEEKLY_PULSE': {
      uniqueKey: 'Period',
      shouldUpdate: (row: any) => row.period === 'Last 7 Days', // Update rolling window, create snapshots
      transformer: (row: any) => {
        const timestamp = new Date().toISOString().split('T')[0];
        const period = row.period === 'Last 7 Days' 
          ? 'Last 7 Days' 
          : `${row.period} (${timestamp})`;
        return {
          'Period': { title: [{ text: { content: period } }] },
          'Page Views': { number: row.views || 0 },
          'Active Users': { number: row.active_users || 0 },
          'New Subscribers': { number: row.new_subscribers || 0 },
          'Views Growth': { number: row.views_change || 0 },
          'Subs Growth': { number: row.subs_change || 0 },
        };
      }
    },
    'BLOG_ANALYTICS': {
      uniqueKey: 'Slug',
      shouldUpdate: () => true, // Always update existing posts
      transformer: (row: any) => ({
        'Slug': { rich_text: [{ text: { content: row.slug || '' } }] },
        'Views': { number: row.views || 0 },
        'Visitors': { number: row.visitors || 0 },
        'Signups': { number: row.signups || 0 },
        'Performance Score': { number: row.performance_score || 0 },
        'Conversion Rate': { number: row.conversion_rate_pct || 0 },
      })
    },
    'TRAFFIC_SOURCES': {
      uniqueKey: 'Source',
      shouldUpdate: () => true, // Always update existing sources
      transformer: (row: any) => ({
        'Source': { title: [{ text: { content: row.source_category || 'Unknown' } }] },
        'Visits': { number: row.visit_count || 0 },
        'Unique Visitors': { number: row.unique_visitors || 0 },
        'Conversions': { number: row.conversions || 0 },
        'Conversion Rate': { number: row.conversion_rate_pct || 0 },
      })
    },
  };

  if (!configs[sourceKey]) {
    throw new Error(`No transformer config found for ${sourceKey}`);
  }

  return configs[sourceKey];
}

// UPDATE: Update a specific Notion page
async function handleUpdate(job: Extract<CmsJob, { action: 'update' }>, env: Bindings, logger: any) {
  const notion = new NotionClient(env.NOTION_API_KEY, env.ASSETS_BUCKET);
  logger.info('Updating Notion page', { pageId: job.pageId });
  // TODO: Implement page update
  // await notion.updatePage(job.pageId, job.properties);
}

async function syncSinglePage(
  pageId: string, 
  notion: NotionClient, 
  supabase: any, 
  logger: any,
  telegram: ReturnType<typeof createTelegramClient>
): Promise<{ title: string; published: boolean }> {
    // 1. Fetch Page Metadata & Content
    const post = await notion.getPost(pageId);
    
    if (!post) {
      logger.warn('Notion page not found or not a valid post', { pageId });
      return { title: 'Unknown', published: false };
    }

    // Track previous status before update
    const { data: existingPost } = await supabase
      .from('posts')
      .select('status')
      .eq('notion_id', post.id)
      .single();
    
    const wasUnpublished = existingPost && existingPost.status !== 'published';
    const isNowPublished = post.published;

    // 2. Upsert into Supabase
    await upsertPost(post, supabase);

    logger.info('Successfully synced post', { 
      slug: post.slug, 
      title: post.title 
    });

    // 3. Send notification for publishing state changes
    if (telegram) {
      try {
        if (wasUnpublished && isNowPublished) {
          // Post was just published
          await telegram.notify('✨', 'Post Published', {
            'Title': post.title,
            'URL': `https://lucascosta.tech/blog/${post.slug}`,
            'Notion ID': post.id
          });
        } else if (!wasUnpublished && !isNowPublished) {
          // Post was unpublished
          await telegram.notify('🔒', 'Post Unpublished', {
            'Title': post.title,
            'Slug': post.slug,
            'Notion ID': post.id
          });
        }
      } catch (error) {
        logger.error('Failed to send Telegram notification', { error });
      }
    }

    // 4. Telemetry
    if (post.published) {
        await insertEvent(supabase, {
            source: 'notion',
            type: 'content.published',
            identity_type: 'user_id',
            identity_value: 'system',
            timestamp: new Date().toISOString(),
            traits: {
                slug: post.slug,
                title: post.title,
                notionId: post.id
            },
            raw: { pageId }
        });
    }

    // Rate Limit Buffer: Ensure we don't hit Notion API too hard
    // Notion limit is ~3 req/sec. We add a small buffer here.
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { title: post.title, published: post.published };
}

async function upsertPost(post: any, supabase: any) {
    const { data, error } = await supabase
      .from('posts')
      .upsert({
        notion_id: post.id, // Use notion_id for matching existing records
        slug: post.slug,
        title: post.title,
        content_mdx: post.content,
        summary: post.summary,
        tags: post.tags,
        featured_image: post.featuredImage,
        status: post.published ? 'published' : 'draft',
        published_at: post.published && post.publishedAt ? post.publishedAt : null,
        updated_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString()
      }, {
        onConflict: 'notion_id' // Conflict on Unique Constraint
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert post: ${error.message}`);
    }

    // Reconcile Tags (Normalized Tables)
    if (post.tags && Array.isArray(post.tags)) {
      await reconcilePostTags(supabase, data.id, post.tags);
    }
}
