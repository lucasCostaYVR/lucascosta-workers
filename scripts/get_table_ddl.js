// Get CREATE TABLE statements for each table
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.dev.vars' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const TABLES = [
  'profiles',
  'identity_graph',
  'marketing_events',
  'posts',
  'tags',
  'post_tags',
  'comments',
  'email_subscriptions'
];

async function getTableDDL(tableName) {
  const { data, error } = await supabase.rpc('get_table_ddl', { 
    table_name: tableName 
  });
  
  if (error) {
    console.log(`\n-- Table: ${tableName}`);
    console.log(`-- Error: ${error.message}`);
    console.log(`-- (RPC function 'get_table_ddl' not available - use Supabase Dashboard → SQL Editor)`);
  } else {
    console.log(data);
  }
}

console.log('-- Run this in Supabase SQL Editor instead:\n');
console.log(`SELECT 
  'CREATE TABLE ' || tablename || ' (' || 
  string_agg(
    attname || ' ' || 
    format_type(atttypid, atttypmod) ||
    CASE WHEN attnotnull THEN ' NOT NULL' ELSE '' END,
    ', '
  ) || ');' as ddl
FROM pg_attribute
JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE nspname = 'public' 
  AND relkind = 'r'
  AND attnum > 0
  AND NOT attisdropped
GROUP BY tablename
ORDER BY tablename;
`);
