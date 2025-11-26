# Notion Dashboard Setup Guide

Based on your Supabase views, here's how to structure your Notion databases for analytics syncing.

---

## 1. EXISTING: Blog Posts Database (Already Set Up)

**Purpose**: Your CMS for writing/publishing posts  
**Sync Direction**: Notion → Supabase (already working)

### Add These Analytics Fields:

| Field Name | Type | Description |
|------------|------|-------------|
| **📊 Page Views** | Number | Total page views (synced from Supabase) |
| **👥 Unique Visitors** | Number | Unique visitors (synced from Supabase) |
| **💬 Comments** | Number | Total comments (synced from Supabase) |
| **📧 Signups** | Number | Newsletter signups attributed to this post |
| **🏆 Performance Score** | Number | Weighted score: Views×1 + Visitors×2 + Comments×5 + Signups×10 |
| **📈 Conversion Rate** | Number | Percentage: (Signups / Visitors) × 100 |
| **🔄 Last Synced** | Date | When analytics were last updated |

**Why**: You'll see performance metrics directly next to your post content in Notion.

---

## 2. NEW: Weekly Metrics Database

**Purpose**: Track high-level KPIs week-over-week  
**Sync Direction**: Supabase → Notion  
**Data Source**: `dashboard_weekly_pulse` view

### Structure:

| Field Name | Type | Description |
|------------|------|-------------|
| **📅 Week** | Title | "Week of Nov 24, 2025" (auto-generated) |
| **👀 Page Views** | Number | Total views this week |
| **👥 Active Users** | Number | Unique visitors |
| **📧 New Subscribers** | Number | Newsletter signups |
| **📊 Views Change** | Number | +/- vs previous week |
| **📈 Subs Change** | Number | +/- vs previous week |
| **🕐 Synced At** | Date | Timestamp |

**Why**: See your weekly growth at a glance. Perfect for a "Dashboard Home" page.

---

## 3. NEW: Traffic Sources Database

**Purpose**: Track where your traffic is coming from  
**Sync Direction**: Supabase → Notion  
**Data Source**: `dashboard_traffic_sources` view

### Structure:

| Field Name | Type | Description |
|------------|------|-------------|
| **🌍 Source** | Title | "Google", "LinkedIn", "Direct", etc. |
| **📊 Visit Count** | Number | Total visits from this source |
| **👥 Unique Visitors** | Number | Unique visitors from this source |
| **📈 Trend** | Relation | Link to historical data (optional) |
| **🕐 Last Updated** | Date | Timestamp |

**Why**: Know where to focus your distribution efforts.

---

## Summary: What You Need to Create in Notion

### Option A: Minimal Setup (Enhance Existing)
1. **Add 7 new columns** to your existing Blog Posts database (the analytics fields listed above)
2. Set up a cron job to sync `dashboard_content_leaderboard` back to Notion every hour

### Option B: Full Dashboard (Recommended)
1. **Blog Posts DB**: Add the 7 analytics columns
2. **Create "Weekly Metrics" DB**: For `dashboard_weekly_pulse` (new DB with 7 columns)
3. **Create "Traffic Sources" DB**: For `dashboard_traffic_sources` (new DB with 5 columns)

### Next Steps:
1. Create the new databases in Notion
2. Copy their Database IDs into `src/lib/cms-mapping.ts`
3. Implement the export logic in `handleExport()` to push data from Supabase to Notion
4. Set up a cron trigger to run the sync hourly

Would you like me to help implement the export handler next?
