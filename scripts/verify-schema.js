import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
      const value = match[2].trim().replace(/^"(.*)"$/, '$1'); // Remove quotes if present
      env[key] = value;
    }
  });
}

const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL or SUPABASE_KEY not found in .dev.vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  console.log('Connecting to Supabase...');
  console.log(`URL: ${supabaseUrl}`);

  const { data, error } = await supabase
    .from('information_schema.columns') // This might not work directly via PostgREST if permissions aren't set
    .select('table_name, column_name, data_type, is_nullable')
    .eq('table_schema', 'public')
    .order('table_name')
    .order('ordinal_position');

  // If direct access to information_schema is blocked (common), we can try an RPC or just list tables if we had an RPC.
  // But usually, the service_role key (if used) might have access, or we might need to use a different approach.
  // Let's try the direct query first. Note: Supabase JS client queries tables, not views/system tables easily unless exposed.
  
  // Alternative: Use the `rpc` if you have a function, but we don't.
  // Alternative 2: Just try to select from the known tables and see their structure by inspecting the response or error? No.
  
  // Actually, Supabase exposes `information_schema` via the SQL Editor, but via the API it's often restricted.
  // However, we can try to just fetch one row from 'posts', 'tags', 'post_tags' to see if they exist and what keys they return.
  
  if (error) {
    console.log('Could not query information_schema directly (likely restricted). Checking known tables...');
    await checkTable('posts');
    await checkTable('tags');
    await checkTable('post_tags');
  } else {
    console.log('\n--- Database Schema ---');
    let currentTable = '';
    data.forEach(row => {
      if (row.table_name !== currentTable) {
        console.log(`\nTable: ${row.table_name}`);
        currentTable = row.table_name;
      }
      console.log(`  - ${row.column_name} (${row.data_type}) ${row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
  }
}

async function checkTable(tableName) {
  console.log(`\nChecking table: ${tableName}...`);
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  
  if (error) {
    console.error(`  ❌ Error: ${error.message}`);
  } else {
    console.log(`  ✅ Table exists.`);
    if (data.length > 0) {
      console.log(`  Columns detected from sample row: ${Object.keys(data[0]).join(', ')}`);
    } else {
      console.log(`  (Table is empty, cannot infer columns from data)`);
      // Try to insert a dummy row to fail and get column info? No, too risky.
    }
  }
}

verifySchema().catch(console.error);
