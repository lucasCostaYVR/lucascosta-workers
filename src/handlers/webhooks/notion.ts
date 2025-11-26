import { Context } from 'hono';
import { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import { NotionWebhookSchema } from '../../schemas';
import { QueueManager } from '../../lib/utils';

export async function handleNotionWebhook(c: Context<{ Bindings: Bindings }>) {
  const logger = createLogger(c.env);
  const queue = new QueueManager(c.env);

  try {
    const body = await c.req.json();
    logger.info('Received Notion webhook', { body });

    // Handle Notion Verification Challenge
    if (body && typeof body === 'object' && 'verification_token' in body) {
      const token = body.verification_token;
      logger.info('Received Notion Verification Token', { token });
      return c.json({ message: 'Verification token received', verification_token: token });
    }

    // Validate payload
    const result = NotionWebhookSchema.safeParse(body);
    
    if (!result.success) {
      logger.warn('Invalid Notion webhook payload', { errors: result.error });
      return c.json({ error: 'Invalid payload' }, 400);
    }

    const { entity, type, data } = result.data;

    // We only care about page updates for now
    if (entity.type === 'page') {
      // Only sync pages from the BLOG_POSTS database (2b4bf95f69cb80db9a23cfc97b4ff4ea)
      const blogPostsDatabaseId = '2b4bf95f69cb80db9a23cfc97b4ff4ea';
      
      // Extract parent database ID - handle both regular databases and data sources
      const parent = (data as any)?.parent;
      const parentDatabaseId = parent?.id || parent?.database_id;
      
      // Normalize IDs (remove hyphens for comparison)
      const normalizedParent = parentDatabaseId?.replace(/-/g, '');
      const normalizedBlogDb = blogPostsDatabaseId.replace(/-/g, '');
      
      if (normalizedParent === normalizedBlogDb) {
        await queue.importFromNotion('BLOG_POSTS', { 
          pageId: entity.id, 
          force: true 
        });
        
        logger.info('Queued CMS import job', { pageId: entity.id, eventType: type, databaseId: parentDatabaseId });
      } else {
        logger.info('Ignoring page update from non-blog database', { 
          pageId: entity.id, 
          parentDatabaseId,
          parentType: parent?.type,
          expectedDatabaseId: blogPostsDatabaseId 
        });
      }
    }

    return c.json({ success: true });

  } catch (error) {
    logger.error('Error handling Notion webhook', { error });
    return c.json({ error: 'Internal Server Error' }, 500);
  }
}
