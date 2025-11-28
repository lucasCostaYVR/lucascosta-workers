-- Migration: Fix Posts Full-Text Search
-- Description: Correct the search_vector column for posts table to use actual columns

-- Drop the incorrect search_vector column if it exists
ALTER TABLE posts DROP COLUMN IF EXISTS search_vector;

-- Add corrected search vector using actual posts table columns
ALTER TABLE posts 
ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(summary, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(content_mdx, '')), 'C')
) STORED;

-- Create GIN index for fast full-text search (drop first if exists)
DROP INDEX IF EXISTS idx_posts_search;
CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);

-- Update snippets search_vector to use correct columns
ALTER TABLE snippets DROP COLUMN IF EXISTS search_vector;
ALTER TABLE snippets 
ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(content_mdx, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'D')
) STORED;

-- Recreate snippets index
DROP INDEX IF EXISTS idx_snippets_search;
CREATE INDEX idx_snippets_search ON snippets USING GIN(search_vector);

COMMENT ON COLUMN posts.search_vector IS 'Full-text search vector for title, summary, and content_mdx';
COMMENT ON COLUMN snippets.search_vector IS 'Full-text search vector for title, description, content_mdx, and category';
