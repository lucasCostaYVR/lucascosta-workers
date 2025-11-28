import { Bindings } from '../../types';

/**
 * Sync Direction
 * Makes it crystal clear which way the data flows
 */
export type SyncDirection = 'from_notion' | 'to_notion';

/**
 * Data Source Configuration
 * Maps your internal data to Notion databases
 */
export interface DataSource {
  key: string;                    // Internal identifier (e.g. 'BLOG_POSTS')
  notionDatabaseId: string;       // Notion Database ID (can be env var key or literal)
  supabaseView?: string;          // Supabase view to sync FROM (e.g. 'dashboard_content_leaderboard')
  syncDirection: SyncDirection[]; // Which directions are supported
  description: string;            // Human-readable description
}

/**
 * Central Configuration for all your Notion ↔ Supabase syncs
 * Add new data sources here without touching code
 */
export const DATA_SOURCES: DataSource[] = [
  {
    key: 'BLOG_POSTS',
    notionDatabaseId: '2b4bf95f69cb80db9a23cfc97b4ff4ea',
    syncDirection: ['from_notion', 'to_notion'], // Bidirectional: import posts, export analytics
    description: 'Blog posts from Notion CMS'
  },
  {
    key: 'BLOG_ANALYTICS',
    notionDatabaseId: '2b4bf95f69cb80db9a23cfc97b4ff4ea', // Same as BLOG_POSTS
    supabaseView: 'dashboard_content_leaderboard',
    syncDirection: ['to_notion'], // Supabase → Notion (your analytics)
    description: 'Blog performance metrics for Notion dashboard'
  },
  {
    key: 'WEEKLY_PULSE',
    notionDatabaseId: '2b5bf95f69cb801bb1e6f954490ed288',
    supabaseView: 'dashboard_weekly_pulse',
    syncDirection: ['to_notion'],
    description: 'Weekly traffic summary'
  },
  {
    key: 'TRAFFIC_SOURCES',
    notionDatabaseId: '6668a5abb4b54e95a81466495b2f9879',
    supabaseView: 'dashboard_traffic_sources',
    syncDirection: ['to_notion'],
    description: 'Traffic source breakdown'
  },
  {
    key: 'CODE_SNIPPETS',
    notionDatabaseId: '2b7bf95f69cb80ec898edfb809d1c971',
    supabaseTable: 'snippets',
    syncDirection: ['from_notion'],
    description: 'Code snippets from Notion'
  }
  // Add more data sources as needed
];

/**
 * Get Data Source by Key
 */
export function getDataSource(key: string): DataSource | undefined {
  return DATA_SOURCES.find(ds => ds.key === key);
}

/**
 * Resolve Notion Database ID
 */
export function resolveNotionDatabaseId(source: DataSource, env: Bindings): string {
  if (!source.notionDatabaseId) {
    throw new Error(`Database ID not configured for ${source.key}. Please add it to DATA_SOURCES in cms-mapping.ts`);
  }
  
  return source.notionDatabaseId;
}
