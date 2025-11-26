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
      const value = match[2].trim().replace(/^"(.*)"$/, '$1');
      env[key] = value;
    }
  });
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

async function testView() {
  console.log('Testing view: analytics_top_pages');
  const { data, error } = await supabase
    .from('analytics_top_pages')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Error querying view:', error.message);
    console.error('Details:', error);
  } else {
    console.log('✅ View is working! Sample data:');
    console.table(data);
  }
}

testView();
