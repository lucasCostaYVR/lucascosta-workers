import type { ProcessedEvent } from '../../schemas'
import type { TelegramClient } from '../clients/telegram'

export interface NotificationConfig {
  emoji: string
  title: string
  includeUser?: boolean
  includePost?: boolean
  includePage?: boolean
  customFields?: (event: ProcessedEvent) => Record<string, any>
}

/**
 * Centralized event notification system
 * Automatically extracts relevant info from events and sends to configured notification channel
 * 
 * @example
 * ```typescript
 * await notifyEvent(telegram, event, {
 *   emoji: '👍',
 *   title: 'New Post Like',
 *   includeUser: true,
 *   includePost: true  // Automatically extracts post_title from event
 * })
 * ```
 */
export async function notifyEvent(
  telegram: TelegramClient | null,
  event: ProcessedEvent,
  config: NotificationConfig
): Promise<void> {
  if (!telegram) return

  try {
    const details: Record<string, any> = {}

    // Extract user info
    if (config.includeUser) {
      if (event.identity_type === 'email') {
        details['User'] = event.identity_value
      } else if (event.identity_type === 'anonymous_id') {
        details['Visitor'] = 'Anonymous'
      }
      
      // Include user's name if available
      const traits = event.traits as Record<string, any>
      if (traits?.name) {
        details['Name'] = traits.name
      }
    }

    // Extract post info from traits
    if (config.includePost && event.traits) {
      const traits = event.traits as Record<string, any>
      
      if (traits.post_title) {
        details['Post'] = traits.post_title
      }
      
      if (traits.post_slug) {
        details['URL'] = `https://lucascosta.tech/blog/${traits.post_slug}`
      }
    }

    // Extract page info
    if (config.includePage && event.traits) {
      const traits = event.traits as Record<string, any>
      
      // Check nested page object first, then flat properties
      const pageTitle = traits.page?.title || traits.page_title
      const pagePath = traits.page?.path || traits.page_path
      const pageUrl = traits.page?.url || traits.page_url
      
      if (pageTitle) {
        details['Page'] = pageTitle
      }
      
      if (pagePath) {
        details['Path'] = pagePath
      }
      
      if (pageUrl) {
        details['URL'] = pageUrl
      }
    }

    // Add custom fields
    if (config.customFields) {
      Object.assign(details, config.customFields(event))
    }

    await telegram.notify(config.emoji, config.title, details)
  } catch (error) {
    // Silent fail - don't break the main flow if notifications fail
    console.error('Failed to send notification:', error)
  }
}
