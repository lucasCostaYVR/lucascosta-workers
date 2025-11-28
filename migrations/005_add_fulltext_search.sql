-- Migration: Add Full-Text Search
-- Description: Add tsvector columns and GIN indexes for full-text search on snippets and posts

-- Add search vector to snippets table
ALTER TABLE snippets 
ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(content, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'D')
) STORED;

-- Add search vector to posts table
ALTER TABLE posts 
ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(summary, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(content, '')), 'C')
) STORED;

-- Create GIN indexes for fast full-text search
CREATE INDEX idx_snippets_search ON snippets USING GIN(search_vector);
CREATE INDEX idx_posts_search ON posts USING GIN(search_vector);

-- Example query (for reference, don't execute):
-- SELECT * FROM snippets 
-- WHERE search_vector @@ websearch_to_tsquery('english', 'your search query')
-- ORDER BY ts_rank(search_vector, websearch_to_tsquery('english', 'your search query')) DESC;
