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

async function testDashboardViews() {
  console.log('Testing Dashboard Views...');

  // 1. Content Leaderboard
  console.log('\n1. Testing dashboard_content_leaderboard...');
  const { data: leaderboard, error: lbError } = await supabase
    .from('dashboard_content_leaderboard')
    .select('title, performance_score, conversion_rate_pct')
    .limit(3);
  
  if (lbError) console.error('❌ Error:', lbError.message);
  else console.table(leaderboard);

  // 2. Weekly Pulse
  console.log('\n2. Testing dashboard_weekly_pulse...');
  const { data: pulse, error: pulseError } = await supabase
    .from('dashboard_weekly_pulse')
    .select('*');
  
  if (pulseError) console.error('❌ Error:', pulseError.message);
  else console.table(pulse);

  // 3. Traffic Sources
  console.log('\n3. Testing dashboard_traffic_sources...');
  const { data: sources, error: srcError } = await supabase
    .from('dashboard_traffic_sources')
    .select('*')
    .limit(5);
  
  if (srcError) console.error('❌ Error:', srcError.message);
  else console.table(sources);
}

testDashboardViews();
