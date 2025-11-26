// Get complete database schema from Supabase
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

config({ path: '.dev.vars' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function getSchema() {
  console.log('🔍 Fetching database schema...\n');

  // Get all tables
  const { data: tables, error: tablesError } = await supabase
    .from('pg_tables')
    .select('tablename')
    .eq('schemaname', 'public')
    .order('tablename');

  if (tablesError) {
    console.error('Error:', tablesError);
    return;
  }

  console.log(`Found ${tables.length} tables\n`);

  let sql = `-- Consolidated Initial Migration
-- Generated on ${new Date().toISOString()}
-- Represents current production database state

`;

  for (const { tablename } of tables) {
    console.log(`Processing: ${tablename}`);
    
    // Query table to get a sample row and infer schema
    const { data: sample } = await supabase
      .from(tablename)
      .select('*')
      .limit(1);

    if (sample && sample.length > 0) {
      const row = sample[0];
      sql += `\n-- Table: ${tablename}\n`;
      sql += `-- Sample columns: ${Object.keys(row).join(', ')}\n`;
      sql += `-- (Run \\d ${tablename} in psql for full schema)\n\n`;
    }
  }

  // Also get views
  const { data: views } = await supabase
    .from('pg_views')
    .select('viewname')
    .eq('schemaname', 'public')
    .order('viewname');

  sql += `\n\n-- VIEWS (${views?.length || 0} found)\n`;
  views?.forEach(({ viewname }) => {
    sql += `-- View: ${viewname}\n`;
  });

  // Get functions
  const { data: functions } = await supabase.rpc('pg_get_functiondef', { funcid: 'merge_anonymous_to_email' });
  
  console.log('\n📝 Writing schema documentation...');
  fs.writeFileSync('migrations/SCHEMA_INVENTORY.md', sql);
  console.log('✅ Created migrations/SCHEMA_INVENTORY.md');
  
  console.log('\n💡 To get full schema DDL, run in Supabase SQL Editor:');
  console.log('   SELECT tablename FROM pg_tables WHERE schemaname = \'public\';');
}

getSchema();
