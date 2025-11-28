import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Site Settings Manager
 * Provides typed access to KV-stored dynamic site configuration
 * 
 * Usage:
 *   const settings = new SiteSettings(env.KV);
 *   const flags = await settings.getFeatureFlags();
 *   if (flags.snippet_ai_suggestions) { ... }
 */

// Type definitions for all settings
export interface FeatureFlags {
  snippet_ai_suggestions: boolean;
  snippet_copy_to_clipboard: boolean;
  post_reading_time: boolean;
  related_posts_section: boolean;
  dark_mode_default: boolean;
  newsletter_popup: boolean;
  code_syntax_themes: string[];
}

export interface SiteAnnouncement {
  enabled: boolean;
  type: 'info' | 'warning' | 'success' | 'promo';
  message: string;
  link?: string;
  dismissible: boolean;
  expiresAt?: string;
}

export interface FeaturedContent {
  hero_post?: string;
  featured_snippets: string[];
  trending_tags: string[];
  highlight_post_slug?: string;
}

export interface RateLimits {
  anonymous_page_views: number;
  anonymous_snippet_likes: number;
  authenticated_api_calls: number;
  contact_form_submissions: number;
  newsletter_signups: number;
}

export interface MaintenanceMode {
  enabled: boolean;
  message: string;
  estimated_end?: string;
  allow_ips?: string[];
  show_countdown: boolean;
}

// Default values (fallbacks if KV is empty)
const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  snippet_ai_suggestions: false,
  snippet_copy_to_clipboard: true,
  post_reading_time: true,
  related_posts_section: true,
  dark_mode_default: false,
  newsletter_popup: false,
  code_syntax_themes: ['dracula', 'github'],
};

const DEFAULT_RATE_LIMITS: RateLimits = {
  anonymous_page_views: 100,
  anonymous_snippet_likes: 20,
  authenticated_api_calls: 1000,
  contact_form_submissions: 3,
  newsletter_signups: 5,
};

export class SiteSettings {
  constructor(private kv: KVNamespace) {}

  /**
   * Get feature flags with fallback to defaults
   */
  async getFeatureFlags(): Promise<FeatureFlags> {
    const value = await this.kv.get<FeatureFlags>('feature_flags', 'json');
    return { ...DEFAULT_FEATURE_FLAGS, ...value };
  }

  /**
   * Update a single feature flag
   */
  async setFeatureFlag(flag: keyof FeatureFlags, value: boolean | string[]): Promise<void> {
    const flags = await this.getFeatureFlags();
    flags[flag] = value as any;
    await this.kv.put('feature_flags', JSON.stringify(flags));
  }

  /**
   * Get active site announcement (null if disabled or expired)
   */
  async getAnnouncement(): Promise<SiteAnnouncement | null> {
    const announcement = await this.kv.get<SiteAnnouncement>('site_announcement', 'json');
    
    if (!announcement || !announcement.enabled) {
      return null;
    }

    // Check if expired
    if (announcement.expiresAt && new Date(announcement.expiresAt) < new Date()) {
      return null;
    }

    return announcement;
  }

  /**
   * Set/update site announcement
   */
  async setAnnouncement(announcement: SiteAnnouncement): Promise<void> {
    await this.kv.put('site_announcement', JSON.stringify(announcement));
  }

  /**
   * Get featured content configuration
   */
  async getFeaturedContent(): Promise<FeaturedContent> {
    const value = await this.kv.get<FeaturedContent>('featured_content', 'json');
    return value || { featured_snippets: [], trending_tags: [] };
  }

  /**
   * Get rate limit configuration
   */
  async getRateLimits(): Promise<RateLimits> {
    const value = await this.kv.get<RateLimits>('rate_limits', 'json');
    return { ...DEFAULT_RATE_LIMITS, ...value };
  }

  /**
   * Check if site is in maintenance mode
   */
  async isMaintenanceMode(clientIp?: string): Promise<{ enabled: boolean; config?: MaintenanceMode }> {
    const config = await this.kv.get<MaintenanceMode>('maintenance', 'json');
    
    if (!config || !config.enabled) {
      return { enabled: false };
    }

    // Allow whitelisted IPs
    if (clientIp && config.allow_ips?.includes(clientIp)) {
      return { enabled: false };
    }

    return { enabled: true, config };
  }

  /**
   * Get raw value from KV (for custom settings)
   */
  async get<T = any>(key: string): Promise<T | null> {
    return await this.kv.get<T>(key, 'json');
  }

  /**
   * Set raw value to KV (for custom settings)
   */
  async set(key: string, value: any, options?: { expirationTtl?: number }): Promise<void> {
    await this.kv.put(key, JSON.stringify(value), options);
  }
}
