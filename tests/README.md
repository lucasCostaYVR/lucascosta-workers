# Identity Resolution Tests

This directory contains tests for the identity resolution system.

## SQL Tests (`identity_scenarios.sql`)

This is the primary test suite for the database functions. It verifies the logic in `migrations/001_identity_resolution.sql`.

### How to run:

1. Open your Supabase Dashboard.
2. Go to the **SQL Editor**.
3. Copy the contents of `identity_scenarios.sql`.
4. Paste it into the editor and click **Run**.

### What it tests:

- **Case A**: Merging two existing profiles (Anonymous + Email).
- **Case B**: Upgrading an anonymous profile to an email profile.
- **Case C**: Linking a new anonymous ID to an existing email profile.
- **Case D**: Creating a brand new profile with both identities.

The script runs in a transaction and rolls back at the end, so it won't clutter your database with test data.
