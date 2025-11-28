-- Migration: Add Code Snippets Support
-- Description: Tables for code snippets with likes, copies, and shared tag system

-- Snippets table
CREATE TABLE snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_mdx TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  
  -- Analytics counters (updated by triggers)
  like_count INTEGER DEFAULT 0,
  copy_count INTEGER DEFAULT 0
);

-- Snippet tags junction table (reuses existing tags table)
CREATE TABLE snippet_tags (
  snippet_id UUID REFERENCES snippets(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (snippet_id, tag_id)
);

-- Snippet likes (similar to post_likes)
CREATE TABLE snippet_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snippet_id UUID REFERENCES snippets(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One like per profile per snippet
  UNIQUE(snippet_id, profile_id)
);

-- Snippet copies tracking
CREATE TABLE snippet_copies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snippet_id UUID REFERENCES snippets(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  copied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_snippets_category ON snippets(category);
CREATE INDEX idx_snippets_status ON snippets(status);
CREATE INDEX idx_snippets_slug ON snippets(slug);
CREATE INDEX idx_snippet_tags_snippet ON snippet_tags(snippet_id);
CREATE INDEX idx_snippet_tags_tag ON snippet_tags(tag_id);
CREATE INDEX idx_snippet_likes_snippet ON snippet_likes(snippet_id);
CREATE INDEX idx_snippet_likes_profile ON snippet_likes(profile_id);
CREATE INDEX idx_snippet_copies_snippet ON snippet_copies(snippet_id);

-- Trigger: Update snippet like_count
CREATE OR REPLACE FUNCTION update_snippet_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE snippets 
    SET like_count = like_count + 1 
    WHERE id = NEW.snippet_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE snippets 
    SET like_count = like_count - 1 
    WHERE id = OLD.snippet_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER snippet_like_count_trigger
AFTER INSERT OR DELETE ON snippet_likes
FOR EACH ROW EXECUTE FUNCTION update_snippet_like_count();

-- Trigger: Update snippet copy_count
CREATE OR REPLACE FUNCTION update_snippet_copy_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE snippets 
    SET copy_count = copy_count + 1 
    WHERE id = NEW.snippet_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE snippets 
    SET copy_count = copy_count - 1 
    WHERE id = OLD.snippet_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER snippet_copy_count_trigger
AFTER INSERT OR DELETE ON snippet_copies
FOR EACH ROW EXECUTE FUNCTION update_snippet_copy_count();
