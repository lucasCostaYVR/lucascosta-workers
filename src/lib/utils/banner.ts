import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Site Banner Manager
 * Manages dynamic site-wide announcement banners stored in KV
 */

export interface SiteBanner {
  enabled: boolean;
  type: 'info' | 'warning' | 'success' | 'promo';
  message: string;
  link?: string;
  linkText?: string;
  dismissible: boolean;
  expiresAt?: string; // ISO date string
}

const DEFAULT_BANNER: SiteBanner = {
  enabled: false,
  type: 'info',
  message: '',
  dismissible: true,
};

export class BannerManager {
  constructor(private kv: KVNamespace) {}

  /**
   * Get active banner (null if disabled or expired)
   */
  async getActiveBanner(): Promise<SiteBanner | null> {
    const banner = await this.kv.get<SiteBanner>('site_banner', 'json');
    
    if (!banner || !banner.enabled) {
      return null;
    }

    // Check if expired
    if (banner.expiresAt && new Date(banner.expiresAt) < new Date()) {
      return null;
    }

    return banner;
  }

  /**
   * Set/update site banner
   */
  async setBanner(banner: SiteBanner): Promise<void> {
    await this.kv.put('site_banner', JSON.stringify(banner));
  }

  /**
   * Disable current banner
   */
  async disableBanner(): Promise<void> {
    const banner = await this.kv.get<SiteBanner>('site_banner', 'json');
    if (banner) {
      banner.enabled = false;
      await this.kv.put('site_banner', JSON.stringify(banner));
    }
  }
}
