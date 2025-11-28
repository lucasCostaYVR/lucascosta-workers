-- Initial Migration: Complete Database Schema
-- This migration creates all tables and views for the lucascosta.tech analytics platform

-- Core Tables
-- ===========

-- Profiles: User/visitor profiles with identity resolution
CREATE TABLE IF NOT EXISTS profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  name TEXT,
  first_name TEXT,
  anonymous_id TEXT,
  user_id UUID,
  source TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_anonymous_id_idx ON profiles(anonymous_id);

-- Identity Graph: Maps different identifiers to profiles
CREATE TABLE IF NOT EXISTS identity_graph (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  identity_type TEXT NOT NULL,
  identity_value TEXT NOT NULL,
  first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(identity_type, identity_value)
);

CREATE INDEX IF NOT EXISTS idx_identity_graph_profile ON identity_graph(profile_id);
CREATE INDEX IF NOT EXISTS idx_identity_graph_lookup ON identity_graph(identity_type, identity_value);
CREATE INDEX IF NOT EXISTS idx_identity_graph_type ON identity_graph(identity_type);

-- Events: Processed events from all sources (web, email, webhooks)
CREATE TABLE IF NOT EXISTS events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ingested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  type TEXT NOT NULL,
  identity_type TEXT NOT NULL,
  identity_value TEXT NOT NULL,
  traits JSONB,
  raw JSONB,
  correlation_id TEXT,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_identity ON events(identity_type, identity_value);

COMMENT ON TABLE events IS 'Processed events from all sources (web, email, webhooks)';

-- Posts: Blog posts synced from Notion
CREATE TABLE IF NOT EXISTS posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notion_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  content_mdx TEXT,
  featured_image TEXT,
  status TEXT NOT NULL DEFAULT 'Draft',
  published_at TIMESTAMP WITH TIME ZONE,
  tags TEXT[],
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_notion_id ON posts(notion_id);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at);

-- Tags: Blog post tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Post Tags: Many-to-many relationship between posts and tags
CREATE TABLE IF NOT EXISTS post_tags (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);

-- Comments: Blog post comments
CREATE TABLE IF NOT EXISTS comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN DEFAULT false,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_profile_id ON comments(profile_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);

-- Post Likes: Track post likes by users (anonymous and authenticated)
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(post_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_profile_id ON post_likes(profile_id);

-- Trigger to update post like_count
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER post_likes_count_trigger
AFTER INSERT OR DELETE ON post_likes
FOR EACH ROW EXECUTE FUNCTION update_post_like_count();

-- Email Subscriptions: Newsletter subscription status
CREATE TABLE IF NOT EXISTS email_subscriptions (
  profile_id TEXT NOT NULL PRIMARY KEY,
  subscribed BOOLEAN,
  source TEXT,
  subscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Analytics Views
-- ===============

-- Analytics Activity Feed: Recent user activity
CREATE OR REPLACE VIEW analytics_activity_feed AS
SELECT
  e.id,
  e.occurred_at,
  e.type AS event_type,
  e.source,
  e.identity_value AS identity_used,
  e.traits,
  p.email AS user_email,
  CASE
    WHEN e.type = 'page.viewed' THEN 'Viewed ' || COALESCE(e.traits->>'page_title', 'a page')
    WHEN e.type = 'newsletter.subscribed' THEN 'Subscribed to newsletter'
    WHEN e.type = 'comment.created' THEN 'Posted a comment'
    WHEN e.type = 'email.opened' THEN 'Opened email: ' || COALESCE(e.traits->>'subject', 'Unknown')
    WHEN e.type = 'email.clicked' THEN 'Clicked link in email'
    ELSE e.type
  END AS details
FROM events e
LEFT JOIN identity_graph ig ON (e.identity_type = ig.identity_type AND e.identity_value = ig.identity_value)
LEFT JOIN profiles p ON ig.profile_id = p.id
ORDER BY e.occurred_at DESC
LIMIT 100;

-- Analytics Daily Traffic: Daily page views and unique visitors
CREATE OR REPLACE VIEW analytics_daily_traffic AS
SELECT
  DATE(occurred_at) AS day,
  COUNT(*) FILTER (WHERE type = 'page.viewed') AS total_views,
  COUNT(DISTINCT identity_value) FILTER (WHERE type = 'page.viewed') AS unique_visitors
FROM events
GROUP BY DATE(occurred_at)
ORDER BY day DESC;

-- Analytics Post Performance: Post engagement metrics
CREATE OR REPLACE VIEW analytics_post_performance AS
SELECT
  p.id,
  p.slug,
  p.title,
  p.status,
  p.published_at,
  COUNT(DISTINCT e.id) FILTER (WHERE e.type = 'page.viewed') AS page_views,
  COUNT(DISTINCT e.identity_value) FILTER (WHERE e.type = 'page.viewed') AS unique_visitors,
  COUNT(DISTINCT e.id) FILTER (WHERE e.type = 'newsletter.subscribed') AS signups,
  COUNT(DISTINCT c.id) AS comments,
  MAX(e.occurred_at) FILTER (WHERE e.type = 'page.viewed') AS last_viewed_at,
  CASE
    WHEN COUNT(DISTINCT e.id) FILTER (WHERE e.type = 'page.viewed') > 0 THEN
      ROUND(
        (COUNT(DISTINCT e.id) FILTER (WHERE e.type = 'newsletter.subscribed')::NUMERIC / 
         NULLIF(COUNT(DISTINCT e.id) FILTER (WHERE e.type = 'page.viewed'), 0)) * 100,
        2
      )
    ELSE 0
  END AS conversion_rate
FROM posts p
LEFT JOIN events e ON (e.traits->>'post_slug' = p.slug OR e.traits->>'page_path' LIKE '%' || p.slug || '%')
LEFT JOIN comments c ON c.post_id = p.id
GROUP BY p.id, p.slug, p.title, p.status, p.published_at
ORDER BY p.published_at DESC;

-- Analytics Top Pages: Most viewed pages
CREATE OR REPLACE VIEW analytics_top_pages AS
SELECT
  e.traits->>'page_path' AS page_path,
  COUNT(*) AS view_count,
  COUNT(DISTINCT e.identity_value) AS unique_visitors
FROM events e
WHERE e.type = 'page.viewed'
  AND e.traits->>'page_path' IS NOT NULL
GROUP BY e.traits->>'page_path'
ORDER BY view_count DESC
LIMIT 50;

-- Customer 360: Complete user profile with engagement metrics
CREATE OR REPLACE VIEW customer_360 AS
SELECT
  p.id AS profile_id,
  p.email,
  p.name,
  p.status,
  p.created_at AS profile_created_at,
  MIN(e.occurred_at) AS first_seen_at,
  MAX(e.occurred_at) AS last_seen_at,
  COUNT(e.id) AS total_events,
  COUNT(e.id) FILTER (WHERE e.type = 'page.viewed') AS total_page_views,
  COUNT(e.id) FILTER (WHERE e.source = 'resend' AND e.type = 'email.sent') AS emails_sent,
  COUNT(e.id) FILTER (WHERE e.source = 'resend' AND e.type = 'email.opened') AS emails_opened,
  COUNT(e.id) FILTER (WHERE e.source = 'resend' AND e.type = 'email.clicked') AS emails_clicked
FROM profiles p
LEFT JOIN identity_graph ig ON ig.profile_id = p.id
LEFT JOIN events e ON (e.identity_type = ig.identity_type AND e.identity_value = ig.identity_value)
GROUP BY p.id, p.email, p.name, p.status, p.created_at;

-- Dashboard Views
-- ===============

-- Dashboard Content Leaderboard: Top performing content
CREATE OR REPLACE VIEW dashboard_content_leaderboard AS
SELECT
  p.id,
  p.slug,
  p.title,
  p.published_at,
  COALESCE(stats.page_views, 0) AS views,
  COALESCE(stats.unique_visitors, 0) AS visitors,
  COALESCE(stats.signups, 0) AS signups,
  COALESCE(stats.comments, 0) AS comments,
  COALESCE(stats.conversion_rate, 0) AS conversion_rate_pct,
  (COALESCE(stats.page_views, 0) * 1 + COALESCE(stats.signups, 0) * 10 + COALESCE(stats.comments, 0) * 5) AS performance_score
FROM posts p
LEFT JOIN analytics_post_performance stats ON stats.id = p.id
WHERE p.status = 'Published'
ORDER BY performance_score DESC
LIMIT 10;

-- Dashboard Traffic Sources: Traffic by referrer
CREATE OR REPLACE VIEW dashboard_traffic_sources AS
SELECT
  CASE
    WHEN e.traits->>'referrer' LIKE '%google.com%' THEN 'Google'
    WHEN e.traits->>'referrer' LIKE '%twitter.com%' OR e.traits->>'referrer' LIKE '%t.co%' THEN 'Twitter'
    WHEN e.traits->>'referrer' LIKE '%linkedin.com%' THEN 'LinkedIn'
    WHEN e.traits->>'referrer' LIKE '%facebook.com%' THEN 'Facebook'
    WHEN e.traits->>'referrer' IS NULL OR e.traits->>'referrer' = '' THEN 'Direct'
    ELSE 'Other'
  END AS source_category,
  COUNT(*) AS visit_count,
  COUNT(DISTINCT e.identity_value) AS unique_visitors,
  COUNT(DISTINCT CASE WHEN e.type = 'newsletter.subscribed' THEN e.identity_value END) AS conversions,
  ROUND(
    (COUNT(DISTINCT CASE WHEN e.type = 'newsletter.subscribed' THEN e.identity_value END)::NUMERIC / 
     NULLIF(COUNT(DISTINCT e.identity_value), 0)) * 100,
    2
  ) AS conversion_rate_pct
FROM events e
WHERE e.type = 'page.viewed'
GROUP BY source_category
ORDER BY visit_count DESC;

-- Dashboard Weekly Pulse: Weekly metrics summary
CREATE OR REPLACE VIEW dashboard_weekly_pulse AS
SELECT
  'This Week' AS period,
  COUNT(DISTINCT e.identity_value) FILTER (WHERE e.occurred_at >= NOW() - INTERVAL '7 days') AS active_users,
  COUNT(*) FILTER (WHERE e.type = 'page.viewed' AND e.occurred_at >= NOW() - INTERVAL '7 days') AS views,
  COUNT(*) FILTER (WHERE e.type = 'newsletter.subscribed' AND e.occurred_at >= NOW() - INTERVAL '7 days') AS new_subscribers,
  (COUNT(*) FILTER (WHERE e.type = 'page.viewed' AND e.occurred_at >= NOW() - INTERVAL '7 days') -
   COUNT(*) FILTER (WHERE e.type = 'page.viewed' AND e.occurred_at >= NOW() - INTERVAL '14 days' AND e.occurred_at < NOW() - INTERVAL '7 days')) AS views_change,
  (COUNT(*) FILTER (WHERE e.type = 'newsletter.subscribed' AND e.occurred_at >= NOW() - INTERVAL '7 days') -
   COUNT(*) FILTER (WHERE e.type = 'newsletter.subscribed' AND e.occurred_at >= NOW() - INTERVAL '14 days' AND e.occurred_at < NOW() - INTERVAL '7 days')) AS subs_change
FROM events e;

-- Note: Views don't need indexes - they use indexes from underlying tables (events, posts, profiles, etc.)
