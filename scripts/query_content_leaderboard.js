import 'dotenv/config';
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

async function queryContentLeaderboard() {
  console.log('📊 Querying dashboard_content_leaderboard view...\n');

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { data, error } = await supabase
    .from('dashboard_content_leaderboard')
    .select('*')
    .limit(3);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('✅ Sample data:');
  console.log(JSON.stringify(data, null, 2));
}

queryContentLeaderboard().catch(console.error);
