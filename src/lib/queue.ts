import { Bindings } from '../types';
import { CmsJob, CmsJobSchema, ProcessedEvent } from '../schemas';
import { getDataSource } from './utils/cms-mapping';

/**
 * Queue Manager
 * Type-safe helpers for all queue operations
 */
export class QueueManager {
  constructor(private env: Bindings) {}

  // ========================================
  // CMS QUEUE OPERATIONS
  // ========================================

  /**
   * IMPORT: Sync FROM Notion → Supabase
   * Use case: Blog posts, pages, etc.
   * 
   * @example
   * queue.importFromNotion('BLOG_POSTS', { pageId: '123', force: true })
   */
  async importFromNotion(sourceKey: string, options: { pageId?: string; force?: boolean } = {}) {
    const source = getDataSource(sourceKey);
    if (!source) throw new Error(`Unknown data source: ${sourceKey}`);
    if (!source.syncDirection.includes('from_notion')) {
      throw new Error(`${sourceKey} does not support import from Notion`);
    }

    const job: CmsJob = {
      action: 'import',
      sourceKey,
      pageId: options.pageId,
      force: options.force || false
    };

    await this.env.CMS_QUEUE.send(CmsJobSchema.parse(job));
  }

  /**
   * EXPORT: Sync TO Notion from Supabase
   * Use case: Dashboard analytics, metrics, etc.
   * 
   * @example
   * queue.exportToNotion('BLOG_ANALYTICS', { clearExisting: true })
   */
  async exportToNotion(sourceKey: string, options: { batchSize?: number; clearExisting?: boolean } = {}) {
    const source = getDataSource(sourceKey);
    if (!source) throw new Error(`Unknown data source: ${sourceKey}`);
    if (!source.syncDirection.includes('to_notion')) {
      throw new Error(`${sourceKey} does not support export to Notion`);
    }

    const job: CmsJob = {
      action: 'export',
      sourceKey,
      batchSize: options.batchSize || 100,
      clearExisting: options.clearExisting || false
    };

    await this.env.CMS_QUEUE.send(CmsJobSchema.parse(job));
  }

  /**
   * UPDATE: Update a specific Notion page
   * Use case: Mark post as published, fix typos, etc.
   * 
   * @example
   * queue.updateNotionPage('page_123', { Status: { status: { name: 'Published' } } })
   */
  async updateNotionPage(pageId: string, properties: Record<string, any>) {
    const job: CmsJob = {
      action: 'update',
      pageId,
      properties
    };

    await this.env.CMS_QUEUE.send(CmsJobSchema.parse(job));
  }

  // ========================================
  // EVENT QUEUE
  // ========================================

  /**
   * Enqueue a Processed Event
   */
  async enqueueEvent(event: ProcessedEvent) {
    await this.env.QUEUE.send(event);
  }
}
