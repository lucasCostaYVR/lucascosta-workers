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

async function checkReferrers() {
  console.log('Checking referrers...');
  const { data, error } = await supabase
    .from('marketing_events')
    .select('traits')
    .eq('type', 'page.viewed')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  data.forEach(row => {
    const context = row.traits.context || {};
    const page = context.page || {};
    const referrer = page.referrer || context.referrer || row.traits.referrer;
    console.log('Referrer:', referrer);
  });
}

checkReferrers();
