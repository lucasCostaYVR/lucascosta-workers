-- Make identity_type and identity_value nullable to support anonymous aggregated tracking
-- 
-- CONSENT MODEL:
-- - WITHOUT consent: identity_type/identity_value = NULL (anonymous aggregated data)
-- - WITH consent: identity_type/identity_value populated (can build user journeys)
--
-- This allows us to:
-- 1. Track page views, like counts for business metrics (legitimate interest)
-- 2. Respect GDPR by not building user profiles without consent
-- 3. Enable personalization/journey tracking only with explicit consent

ALTER TABLE events 
  ALTER COLUMN identity_type DROP NOT NULL,
  ALTER COLUMN identity_value DROP NOT NULL;

-- Add partial index for queries by identity (only when identity exists)
CREATE INDEX IF NOT EXISTS idx_events_identity_exists 
  ON events (identity_type, identity_value, occurred_at DESC)
  WHERE identity_type IS NOT NULL AND identity_value IS NOT NULL;

-- Add index for anonymous events (for aggregated analytics)
CREATE INDEX IF NOT EXISTS idx_events_anonymous 
  ON events (type, occurred_at DESC)
  WHERE identity_type IS NULL;

COMMENT ON COLUMN events.identity_type IS 'Identity type (anonymous_id, email, profile_id). NULL for anonymous aggregated events (no consent).';
COMMENT ON COLUMN events.identity_value IS 'Identity value. NULL for anonymous aggregated events (no consent).';
