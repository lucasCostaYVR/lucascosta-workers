import { z} from "zod";

export const GhostMemberSchema = z.object({
  member: z.object({
    current: z.object({
      id: z.string(),
      uuid: z.string(),
      email: z.string().email(),
      name: z.string(),
      note: z.string().nullable(),
      geolocation: z.string().optional().nullable(), // JSON string in your example
      subscribed: z.boolean(),
      created_at: z.string().optional().nullable(),  // ISO datetime string
      updated_at: z.string().optional().nullable(),  // ISO datetime string
      labels: z.array(z.unknown()),
      subscriptions: z.array(z.unknown()),
      avatar_image: z.url(),
      comped: z.boolean(),
      email_count: z.number(),
      email_opened_count: z.number(),
      email_open_rate: z.number().nullable(),
      status: z.string(),
      last_seen_at: z.string().optional().nullable(), // current has a string here
      newsletters: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          status: z.string(),
        })
      ),
    }),
    previous: z.object({
      note: z.string().nullable().optional(),
      last_seen_at: z.string().nullable().optional(),
      updated_at: z.string().nullable().optional(),
      newsletters: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().nullable(),
          status: z.string(),
        })
      ).optional(),
    }),
  }),
});

export const EventTypeSchema = z.enum([
  // Ghost
  'subscriber.created',
  'newsletter.subscribed',
  'newsletter.unsubscribed',
  'member.edited',
  // Resend
  'email.sent',
  'email.delivered',
  'email.opened',
  'email.clicked',
  'email.bounced',
  'email.complained',
  'contact.created',
  'contact.updated',
  'contact.submitted',
  // Comments
  'comment.created',
  'comment.updated',
  'comment.deleted',
  // Web
  'page.view',
  'ui.click',
  'form.submit',
  // Post Engagement
  'post.liked',
  'post.unliked',
  // Snippet Engagement
  'snippet.viewed',
  'snippet.liked',
  'snippet.unliked',
  'snippet.copied',
  'snippet.searched'
]);

export const NotionWebhookSchema = z.object({
  source: z.literal('notion').optional(), // Notion doesn't send 'source: notion' in the body
  // Notion webhooks are generic, usually just indicating a change
  // We might receive a page ID or database ID
  data: z.object({
    // The payload structure is different than what we assumed.
    // It seems 'data' contains the change info, but the ID is at the top level or inside 'data' depending on event
    // Based on logs:
    // {
    //   id: '...',
    //   entity: { id: '...', type: 'page' },
    //   type: 'page.created' | 'page.updated'
    // }
  }).passthrough().optional(),
  
  // Actual structure based on logs
  id: z.string(),
  type: z.string(), // e.g. 'page.created', 'page.properties_updated'
  entity: z.object({
    id: z.string(),
    type: z.string() // 'page', 'database'
  })
}).passthrough();

/**
 * CMS Job Schema (Modular & Clear)
 * Supports three distinct operations:
 * 1. Import from Notion (Webhook-driven or manual)
 * 2. Export to Notion (Cron-driven analytics sync)
 * 3. Update Notion (Ad-hoc property updates)
 */
export const CmsJobSchema = z.discriminatedUnion('action', [
  // 1. IMPORT: Sync FROM Notion → Supabase (e.g. blog posts)
  z.object({
    action: z.literal('import'),
    sourceKey: z.string(), // Key from DATA_SOURCES (e.g. 'BLOG_POSTS')
    pageId: z.string().optional(), // If provided, sync only this page
    force: z.boolean().default(false)
  }),

  // 2. EXPORT: Sync TO Notion from Supabase (e.g. analytics dashboard)
  z.object({
    action: z.literal('export'),
    sourceKey: z.string(), // Key from DATA_SOURCES (e.g. 'BLOG_ANALYTICS')
    batchSize: z.number().default(100), // How many rows to sync at once
    clearExisting: z.boolean().default(false) // Clear old data before syncing?
  }),

  // 3. UPDATE: Update a specific Notion page (e.g. mark as published)
  z.object({
    action: z.literal('update'),
    pageId: z.string(),
    properties: z.record(z.string(), z.any())
  })
]);

export type CmsJob = z.infer<typeof CmsJobSchema>;

// Legacy Schema (Keep for now until migration is complete)
export const CmsSyncJobSchema = z.object({
  type: z.literal('cms.sync'),
  force: z.boolean().default(false),
  target: z.enum(['all', 'posts', 'pages']).default('all'),
  pageId: z.string().optional()
});

export type CmsSyncJob = z.infer<typeof CmsSyncJobSchema>;

export const ProcessedEventSchema = z.object({
  source: z.enum(['ghost', 'resend', 'web', 'notion']),
  type: EventTypeSchema.or(z.string()), // Allow string for backward compatibility or new events
  identity_value: z.string(),
  identity_type: z.enum(['email', 'anonymous_id', 'user_id']),
  traits: z.object({
    email: z.string().optional(),
    name: z.string().nullable().optional(),
    status: z.string().optional(),
    geo: z.object({}).optional() // Allows for a geo object with unknown structure
  }).loose(), // Allows extra keys if needed
  timestamp: z.string(),
  raw: z.any()
})

// MAGIC: Extract the TypeScript interface from the Zod schema
export type ProcessedEvent = z.infer<typeof ProcessedEventSchema>

// Backwards compatibility alias (will be removed in future)
/** @deprecated Use ProcessedEvent instead */
export type MarketingEvent = ProcessedEvent

export type GhostQueueMessage = {
  type: 'ghost.member.updated' | 'ghost.member.created';
  receivedAt: string;
  member: z.infer<typeof GhostMemberSchema>['member']['current'];
};


/**
 * Generic WebEvent coming from your site.
 * Covers page views, clicks, etc. using:
 * - name: event name ("page_view", "button_click", "cta_submitted", ...)
 * - context: shared web metadata (url, path, referrer, userAgent, etc.)
 * - properties: event-specific data (anything)
 */
export const WebEventSchema = z.object({
  // required, generic event name
  name: z.string().min(1), // ex: "page_view", "cta_click", "signup_submitted"

  // optional client timestamp; fallback to server time
  timestamp: z.iso.datetime().optional(),

  // identity information (optional)
  anonymousId: z.string().optional(),         // browser/session id
  user: z
    .object({
      email: z.string().email().optional(),
      id: z.string().optional(),             // if you ever have an internal user id
      profile_id: z.string().optional(),     // for magic links
      name: z.string().optional(),           // user's display name
    })
    .partial()
    .optional(),

  // generic web context
  context: z
    .object({
      url: z.string().url().optional(),
      path: z.string().optional(),
      title: z.string().optional(),
      referrer: z.string().optional(),
      userAgent: z.string().optional(),
      locale: z.string().optional(),
      // Standard Segment/Rudderstack Page Object
      page: z.object({
        path: z.string().optional(),
        referrer: z.string().optional(),
        search: z.string().optional(),
        title: z.string().optional(),
        url: z.string().optional()
      }).optional()
    })
    .passthrough() // Allow extra context keys (e.g. campaign, ip)
    .optional(),

  // event-specific properties (free-form)
  properties: z.record(z.string(), z.unknown()).optional(),
});

export type WebEvent = z.infer<typeof WebEventSchema>;

export const ResendWebhookSchema = z.object({
  type: z.string(),
  created_at: z.string(),
  data: z.object({
    // Common fields
    created_at: z.string().optional(),
    
    // Email Event Fields
    email_id: z.string().optional(),
    from: z.string().optional(),
    to: z.array(z.string()).optional(),
    subject: z.string().optional(),
    url: z.string().optional(), // Click events
    
    // Bounce Fields
    bounce: z.object({
      id: z.string().optional(),
      type: z.string(),
      subType: z.string().optional(),
      message: z.string().optional(),
    }).optional(),

    // Contact Event Fields
    id: z.string().optional(), // Contact ID
    audience_id: z.string().optional(),
    email: z.string().optional(), // Contact email
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    unsubscribed: z.boolean().optional(),
  }).loose()
});

