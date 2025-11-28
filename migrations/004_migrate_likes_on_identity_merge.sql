-- Migration: Migrate Likes on Identity Merge
-- Description: When anonymous identity merges with email identity, migrate post_likes and snippet_likes

-- Drop existing function if it exists (to update it)
DROP FUNCTION IF EXISTS merge_anonymous_to_email(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION merge_anonymous_to_email(
  p_email TEXT,
  p_anonymous_id TEXT,
  p_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  profile_id UUID,
  email_profile_id UUID,
  anonymous_profile_id UUID,
  action TEXT
) AS $$
DECLARE
  v_email_profile_id UUID;
  v_anon_profile_id UUID;
  v_action TEXT;
  v_post_likes_migrated INT;
  v_snippet_likes_migrated INT;
  v_snippet_copies_migrated INT;
BEGIN
  -- 1. Get or create profile for email
  SELECT id INTO v_email_profile_id
  FROM profiles
  WHERE email = p_email;

  IF v_email_profile_id IS NULL THEN
    INSERT INTO profiles (email, name, status)
    VALUES (p_email, p_name, COALESCE(p_status, 'active'))
    RETURNING id INTO v_email_profile_id;
    
    v_action := 'created';
  ELSE
    -- Update existing profile metadata if provided
    IF p_name IS NOT NULL OR p_status IS NOT NULL THEN
      UPDATE profiles
      SET 
        name = COALESCE(p_name, name),
        status = COALESCE(p_status, status),
        updated_at = NOW()
      WHERE id = v_email_profile_id;
    END IF;
    
    v_action := 'found';
  END IF;

  -- 2. Get profile for anonymous ID
  SELECT profile_id INTO v_anon_profile_id
  FROM identity_graph
  WHERE identity_type = 'anonymous_id' 
  AND identity_value = p_anonymous_id
  LIMIT 1;

  -- 3. Link anonymous ID to email profile in identity graph
  IF v_anon_profile_id IS NULL THEN
    -- No existing anonymous profile, just link the anonymous_id to email profile
    INSERT INTO identity_graph (profile_id, identity_type, identity_value)
    VALUES (v_email_profile_id, 'anonymous_id', p_anonymous_id)
    ON CONFLICT (identity_type, identity_value) DO NOTHING;
    
    v_action := v_action || '_linked';
  ELSIF v_anon_profile_id = v_email_profile_id THEN
    -- Already linked, nothing to do
    v_action := v_action || '_already_linked';
  ELSE
    -- Merge: Re-point anonymous identity to email profile
    UPDATE identity_graph
    SET profile_id = v_email_profile_id,
        updated_at = NOW()
    WHERE identity_type = 'anonymous_id' 
    AND identity_value = p_anonymous_id;
    
    -- MIGRATE POST LIKES
    -- Insert likes from anonymous profile to email profile (ignore duplicates)
    INSERT INTO post_likes (post_id, profile_id, created_at)
    SELECT post_id, v_email_profile_id, created_at
    FROM post_likes
    WHERE profile_id = v_anon_profile_id
    ON CONFLICT (post_id, profile_id) DO NOTHING;
    
    GET DIAGNOSTICS v_post_likes_migrated = ROW_COUNT;
    
    -- Delete old anonymous post likes
    DELETE FROM post_likes WHERE profile_id = v_anon_profile_id;
    
    -- MIGRATE SNIPPET LIKES
    -- Insert likes from anonymous profile to email profile (ignore duplicates)
    INSERT INTO snippet_likes (snippet_id, profile_id, created_at)
    SELECT snippet_id, v_email_profile_id, created_at
    FROM snippet_likes
    WHERE profile_id = v_anon_profile_id
    ON CONFLICT (snippet_id, profile_id) DO NOTHING;
    
    GET DIAGNOSTICS v_snippet_likes_migrated = ROW_COUNT;
    
    -- Delete old anonymous snippet likes
    DELETE FROM snippet_likes WHERE profile_id = v_anon_profile_id;
    
    -- MIGRATE SNIPPET COPIES
    -- Update snippet copies to point to email profile
    UPDATE snippet_copies 
    SET profile_id = v_email_profile_id 
    WHERE profile_id = v_anon_profile_id;
    
    GET DIAGNOSTICS v_snippet_copies_migrated = ROW_COUNT;
    
    v_action := v_action || '_merged';
    
    -- Log migration stats
    RAISE NOTICE 'Identity merge complete: % post likes, % snippet likes, % snippet copies migrated', 
      v_post_likes_migrated, v_snippet_likes_migrated, v_snippet_copies_migrated;
  END IF;

  -- 4. Ensure email is also tracked in identity graph
  INSERT INTO identity_graph (profile_id, identity_type, identity_value)
  VALUES (v_email_profile_id, 'email', p_email)
  ON CONFLICT (identity_type, identity_value) DO NOTHING;

  -- 5. Update canonical_profile_id for all identities
  UPDATE identity_graph
  SET canonical_profile_id = v_email_profile_id,
      updated_at = NOW()
  WHERE profile_id = v_email_profile_id
  OR profile_id = v_anon_profile_id;

  -- 6. Return result
  RETURN QUERY SELECT 
    v_email_profile_id as profile_id,
    v_email_profile_id as email_profile_id,
    v_anon_profile_id as anonymous_profile_id,
    v_action as action;
END;
$$ LANGUAGE plpgsql;

-- Create index to speed up like migrations during merge
CREATE INDEX IF NOT EXISTS idx_post_likes_profile ON post_likes(profile_id);
CREATE INDEX IF NOT EXISTS idx_snippet_likes_profile ON snippet_likes(profile_id);
CREATE INDEX IF NOT EXISTS idx_snippet_copies_profile ON snippet_copies(profile_id);
