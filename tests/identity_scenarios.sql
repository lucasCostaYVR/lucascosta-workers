-- ====================================================================================
-- IDENTITY RESOLUTION TEST SUITE
-- ====================================================================================
-- Run this script in the Supabase SQL Editor.
-- It returns a table of results so you can verify passes.

BEGIN;

-- Create a temp table to store results
CREATE TEMP TABLE test_results (
  id SERIAL PRIMARY KEY,
  scenario TEXT,
  status TEXT,
  message TEXT
);

-- ------------------------------------------------------------------------------------
-- 0. CLEANUP
-- ------------------------------------------------------------------------------------
DO $$
BEGIN
  DELETE FROM profiles WHERE email LIKE 'test_%@example.com';
END $$;

-- ------------------------------------------------------------------------------------
-- SCENARIO 1: CASE D (New User)
-- ------------------------------------------------------------------------------------
DO $$
DECLARE
  v_res RECORD;
  v_count INT;
BEGIN
  SELECT * INTO v_res FROM merge_anonymous_to_email('test_d@example.com', 'test_anon_d', 'Test D', 'free');
  
  IF v_res.was_new_profile = TRUE AND v_res.was_merged = FALSE THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE D', 'PASS', 'Created new profile');
  ELSE
    RAISE EXCEPTION 'CASE D FAILED: Expected new profile';
  END IF;

  SELECT COUNT(*) INTO v_count FROM identity_graph WHERE profile_id = v_res.profile_id;
  IF v_count = 2 THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE D', 'PASS', 'Profile has 2 identities');
  ELSE
    RAISE EXCEPTION 'CASE D FAILED: Expected 2 identities';
  END IF;
END $$;

-- ------------------------------------------------------------------------------------
-- SCENARIO 2: CASE C (Link Anonymous to Existing Email)
-- ------------------------------------------------------------------------------------
DO $$
DECLARE
  v_email_pid UUID;
  v_res RECORD;
  v_count INT;
BEGIN
  INSERT INTO profiles (email, name) VALUES ('test_c@example.com', 'Test C') RETURNING id INTO v_email_pid;
  INSERT INTO identity_graph (profile_id, identity_type, identity_value) VALUES (v_email_pid, 'email', 'test_c@example.com');

  SELECT * INTO v_res FROM merge_anonymous_to_email('test_c@example.com', 'test_anon_c');

  IF v_res.profile_id = v_email_pid THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE C', 'PASS', 'Kept existing profile ID');
  ELSE
    RAISE EXCEPTION 'CASE C FAILED: Profile ID changed';
  END IF;

  SELECT COUNT(*) INTO v_count FROM identity_graph WHERE profile_id = v_res.profile_id;
  IF v_count = 2 THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE C', 'PASS', 'Profile has 2 identities');
  ELSE
    RAISE EXCEPTION 'CASE C FAILED: Expected 2 identities';
  END IF;
END $$;

-- ------------------------------------------------------------------------------------
-- SCENARIO 3: CASE B (Add Email to Anonymous)
-- ------------------------------------------------------------------------------------
DO $$
DECLARE
  v_anon_pid UUID;
  v_res RECORD;
  v_email TEXT;
BEGIN
  v_anon_pid := get_or_create_profile_by_anonymous_id('test_anon_b');

  SELECT * INTO v_res FROM merge_anonymous_to_email('test_b@example.com', 'test_anon_b', 'Test B');

  IF v_res.profile_id = v_anon_pid THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE B', 'PASS', 'Kept anonymous profile ID');
  ELSE
    RAISE EXCEPTION 'CASE B FAILED: Profile ID changed';
  END IF;

  IF v_res.was_merged = TRUE THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE B', 'PASS', 'Flagged as merged');
  ELSE
    RAISE EXCEPTION 'CASE B FAILED: Expected was_merged=TRUE';
  END IF;

  SELECT email INTO v_email FROM profiles WHERE id = v_res.profile_id;
  IF v_email = 'test_b@example.com' THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE B', 'PASS', 'Profile email updated');
  ELSE
    RAISE EXCEPTION 'CASE B FAILED: Profile email not updated';
  END IF;
END $$;

-- ------------------------------------------------------------------------------------
-- SCENARIO 4: CASE A (Merge Two Profiles)
-- ------------------------------------------------------------------------------------
DO $$
DECLARE
  v_email_pid UUID;
  v_anon_pid UUID;
  v_res RECORD;
  v_count INT;
  v_old_exists BOOLEAN;
BEGIN
  INSERT INTO profiles (email, name) VALUES ('test_a@example.com', 'Test A') RETURNING id INTO v_email_pid;
  INSERT INTO identity_graph (profile_id, identity_type, identity_value) VALUES (v_email_pid, 'email', 'test_a@example.com');

  v_anon_pid := get_or_create_profile_by_anonymous_id('test_anon_a');

  SELECT * INTO v_res FROM merge_anonymous_to_email('test_a@example.com', 'test_anon_a');

  IF v_res.profile_id = v_email_pid THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE A', 'PASS', 'Retained email profile ID');
  ELSE
    RAISE EXCEPTION 'CASE A FAILED: Did not retain email profile ID';
  END IF;

  IF v_res.was_merged = TRUE THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE A', 'PASS', 'Flagged as merged');
  ELSE
    RAISE EXCEPTION 'CASE A FAILED: Expected was_merged=TRUE';
  END IF;

  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = v_anon_pid) INTO v_old_exists;
  IF v_old_exists = FALSE THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE A', 'PASS', 'Old anonymous profile deleted');
  ELSE
    RAISE EXCEPTION 'CASE A FAILED: Old anonymous profile still exists';
  END IF;

  SELECT COUNT(*) INTO v_count FROM identity_graph WHERE profile_id = v_email_pid;
  IF v_count = 2 THEN
    INSERT INTO test_results (scenario, status, message) VALUES ('CASE A', 'PASS', 'Target profile has 2 identities');
  ELSE
    RAISE EXCEPTION 'CASE A FAILED: Expected 2 identities';
  END IF;
END $$;

-- Final Output
SELECT scenario, status, message FROM test_results ORDER BY id;

ROLLBACK;
