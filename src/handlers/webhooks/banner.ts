import { Hono } from 'hono';
import type { Bindings } from '../../types';
import { BannerManager } from '../../lib/utils/banner';
import { createLogger } from '../../lib/utils';

/**
 * Site Banner API (Admin Only)
 * 
 * POST /api/banner - Create/update banner (protected)
 * DELETE /api/banner - Disable banner (protected)
 * 
 * Note: Frontend should read from KV directly, not via HTTP.
 * This API is only for admin management and Airtable sync.
 */

const app = new Hono<{ Bindings: Bindings }>();

// Create/update banner (protected)
app.post('/', async (c) => {
  const logger = createLogger(c.env);
  
  // Check admin secret
  const authHeader = c.req.header('Authorization');
  if (!authHeader || authHeader !== `Bearer ${c.env.ADMIN_SECRET}`) {
    logger.warn('Unauthorized banner update attempt');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const bannerManager = new BannerManager(c.env.SITE_SETTINGS);
  
  await bannerManager.setBanner(body);
  
  logger.info('Banner updated', { type: body.type, enabled: body.enabled });
  
  return c.json({ success: true, banner: body });
});

// Disable banner (protected)
app.delete('/', async (c) => {
  const logger = createLogger(c.env);
  
  // Check admin secret
  const authHeader = c.req.header('Authorization');
  if (!authHeader || authHeader !== `Bearer ${c.env.ADMIN_SECRET}`) {
    logger.warn('Unauthorized banner delete attempt');
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const bannerManager = new BannerManager(c.env.SITE_SETTINGS);
  await bannerManager.disableBanner();
  
  logger.info('Banner disabled');
  
  return c.json({ success: true });
});

export default app;
