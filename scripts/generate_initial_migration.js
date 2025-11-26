// Script to generate consolidated initial migration from live database
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

config({ path: '.dev.vars' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function generateInitialMigration() {
  console.log('🔍 Inspecting live database schema...\n');

  const { data: tables, error } = await supabase.rpc('get_schema_info');
  
  if (error) {
    console.error('Error fetching schema:', error);
    return;
  }

  // For now, let's just get the table structure using information_schema
  const { data: tableNames } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');

  console.log('📊 Found tables:', tableNames);

  // Generate SQL for each table
  let migrationSQL = `-- Consolidated Initial Migration
-- Generated on ${new Date().toISOString()}
-- This represents the current state of the production database

`;

  for (const { table_name } of tableNames || []) {
    console.log(`\n📋 Processing table: ${table_name}`);
    
    // Get column information
    const { data: columns } = await supabase
      .from('information_schema.columns')
      .select('*')
      .eq('table_schema', 'public')
      .eq('table_name', table_name)
      .order('ordinal_position');

    migrationSQL += `\n-- Table: ${table_name}\n`;
    migrationSQL += `CREATE TABLE IF NOT EXISTS ${table_name} (\n`;
    
    const columnDefs = columns?.map(col => {
      let def = `  ${col.column_name} ${col.data_type}`;
      if (col.character_maximum_length) {
        def += `(${col.character_maximum_length})`;
      }
      if (col.is_nullable === 'NO') {
        def += ' NOT NULL';
      }
      if (col.column_default) {
        def += ` DEFAULT ${col.column_default}`;
      }
      return def;
    });

    migrationSQL += columnDefs?.join(',\n') || '';
    migrationSQL += `\n);\n`;
  }

  // Write to file
  fs.writeFileSync(
    'migrations/001_initial_schema.sql',
    migrationSQL
  );

  console.log('\n✅ Generated migrations/001_initial_schema.sql');
}

generateInitialMigration();
