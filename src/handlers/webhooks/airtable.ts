import { Hono } from 'hono';
import type { Bindings } from '../../types';
import { createLogger } from '../../lib/utils';
import { getActiveBannerFromAirtable, type AirtableBannerFields } from '../../lib/clients/airtable';
import { BannerManager, type SiteBanner } from '../../lib/utils/banner';
import { sendTelegramNotification } from '../../lib/clients/telegram';

/**
 * Airtable Webhook Handler
 * Syncs Airtable changes to KV automatically
 * 
 * POST /webhooks/airtable - Receive Airtable webhook (or manual trigger)
 */

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Transform Airtable banner to KV banner format
 */
function transformAirtableBanner(airtable: AirtableBannerFields): SiteBanner {
  return {
    enabled: true, // Already filtered to active
    type: airtable.Type,
    message: airtable.Message,
    link: airtable.Link,
    linkText: airtable['Link Text'],
    dismissible: airtable.Dismissible ?? true,
    expiresAt: airtable['End Date'],
  };
}

/**
 * Sync Airtable banners to KV
 */
app.post('/', async (c) => {
  const logger = createLogger(c.env);
  
  try {
    // Fetch active banner from Airtable
    const airtableBanner = await getActiveBannerFromAirtable(
      {
        apiKey: c.env.AIRTABLE_API_KEY,
        baseId: c.env.AIRTABLE_BASE_ID,
      },
      c.env.AIRTABLE_BANNERS_TABLE_ID
    );

    const bannerManager = new BannerManager(c.env.SITE_SETTINGS);

    if (!airtableBanner) {
      // No active banner - disable current one
      await bannerManager.disableBanner();
      logger.info('Airtable sync: No active banner, disabled current banner');
      
      // Notify via Telegram
      await sendTelegramNotification(
        c.env.TELEGRAM_BOT_TOKEN,
        c.env.TELEGRAM_CHAT_ID,
        '🔕 Site Banner Disabled\n\nNo active banner found in Airtable. Current banner has been removed from the site.'
      );
      
      return c.json({ 
        success: true, 
        action: 'disabled',
        message: 'No active banner in Airtable' 
      });
    }

    // Transform and save banner
    const banner = transformAirtableBanner(airtableBanner);
    await bannerManager.setBanner(banner);
    
    logger.info('Airtable sync: Banner updated', { 
      type: banner.type,
      message: banner.message.substring(0, 50) + '...'
    });

    // Notify via Telegram
    const bannerTypeEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      success: '✅',
      promo: '🎉',
    }[banner.type] || '📢';

    await sendTelegramNotification(
      c.env.TELEGRAM_BOT_TOKEN,
      c.env.TELEGRAM_CHAT_ID,
      `${bannerTypeEmoji} Site Banner Updated

Type: ${banner.type}
Message: ${banner.message}
${banner.link ? `Link: ${banner.link}` : ''}
${banner.expiresAt ? `Expires: ${banner.expiresAt}` : ''}
Dismissible: ${banner.dismissible ? 'Yes' : 'No'}

Banner is now live on lucascosta.tech!`
    );

    return c.json({ 
      success: true, 
      action: 'updated',
      banner 
    });
    
  } catch (error) {
    logger.error('Airtable sync failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500);
  }
});

export default app;
