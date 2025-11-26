import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .dev.vars
const devVarsPath = path.join(__dirname, '../.dev.vars');
const env = {};

if (fs.existsSync(devVarsPath)) {
  const content = fs.readFileSync(devVarsPath, 'utf-8');
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)="(.*)"$/) || line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^"(.*)"$/, '$1');
      env[key] = value;
    }
  });
}

async function runMigration() {
  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .dev.vars');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔄 Running migration: 013_fix_identity_race_condition.sql\n');

  const migrationPath = path.join(__dirname, '../migrations/013_fix_identity_race_condition.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();
    
    if (error) {
      // Try direct execution if exec_sql doesn't exist
      const lines = sql.split(';').filter(line => line.trim());
      for (const line of lines) {
        if (line.trim()) {
          const { error: execError } = await supabase.rpc('exec', { query: line });
          if (execError) {
            console.error('❌ Migration failed:', execError.message);
            process.exit(1);
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('\nThe merge_anonymous_to_email function now handles race conditions.');
    console.log('Concurrent requests with the same email will no longer fail.\n');

  } catch (error) {
    console.error('❌ Failed to run migration:', error.message);
    console.log('\n💡 You can run this migration manually in Supabase SQL Editor:');
    console.log('   https://supabase.com/dashboard/project/[your-project]/sql/new\n');
    process.exit(1);
  }
}

runMigration();
