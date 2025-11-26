import { Bindings } from '../../types';
import { getSupabaseClient } from '../../lib/clients/supabase';
import { createTelegramClient } from '../../lib/clients';
import { createLogger } from '../../lib/utils';

/**
 * Send daily summary Telegram notification at 8 PM
 * Metrics: Page Views, Unique Visitors, Newsletter Signups, Top Page
 */
export async function sendDailySummary(env: Bindings): Promise<void> {
  const logger = createLogger(env);
  const supabase = getSupabaseClient(env);
  const telegram = createTelegramClient(env);

  if (!telegram) {
    logger.warn('Telegram not configured, skipping daily summary');
    return;
  }

  try {
    // Get today's date range (UTC)
    const today = new Date();
    const startOfDay = new Date(today.setUTCHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setUTCHours(23, 59, 59, 999)).toISOString();

    // 1. Page Views (today)
    const { data: pageViewsData, error: pageViewsError } = await supabase
      .from('events')
      .select('event_id', { count: 'exact', head: true })
      .eq('event_type', 'page.viewed')
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay);

    if (pageViewsError) throw pageViewsError;
    const pageViews = pageViewsData || 0;

    // 2. Unique Visitors (today)
    const { data: visitorsData, error: visitorsError } = await supabase
      .rpc('count_unique_visitors_today', { 
        start_date: startOfDay, 
        end_date: endOfDay 
      });

    if (visitorsError) throw visitorsError;
    const uniqueVisitors = visitorsData || 0;

    // 3. Newsletter Signups (today)
    const { data: signupsData, error: signupsError } = await supabase
      .from('events')
      .select('event_id', { count: 'exact', head: true })
      .eq('event_type', 'newsletter.subscribed')
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay);

    if (signupsError) throw signupsError;
    const newsletterSignups = signupsData || 0;

    // 4. Top Page Viewed (today)
    const { data: topPageData, error: topPageError } = await supabase
      .from('events')
      .select('traits')
      .eq('event_type', 'page.viewed')
      .gte('timestamp', startOfDay)
      .lte('timestamp', endOfDay);

    if (topPageError) throw topPageError;

    // Count page views by path
    const pageCounts: Record<string, number> = {};
    topPageData?.forEach((event: any) => {
      const path = event.traits?.path || 'Unknown';
      pageCounts[path] = (pageCounts[path] || 0) + 1;
    });

    const topPage = Object.entries(pageCounts)
      .sort(([, a], [, b]) => b - a)[0];
    
    const topPagePath = topPage ? topPage[0] : 'None';
    const topPageViews = topPage ? topPage[1] : 0;

    // Send notification
    await telegram.notify('📊', 'Daily Summary', {
      'Date': today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      'Page Views': String(pageViews),
      'Unique Visitors': String(uniqueVisitors),
      'Newsletter Signups': String(newsletterSignups),
      'Top Page': `${topPagePath} (${topPageViews} views)`
    });

    logger.info('Daily summary sent', { 
      pageViews, 
      uniqueVisitors, 
      newsletterSignups, 
      topPage: topPagePath 
    });

  } catch (error) {
    logger.error('Failed to send daily summary', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
