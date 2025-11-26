import { createClient } from '@supabase/supabase-js';
import { Client } from '@notionhq/client';
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

const WEEKLY_PULSE_DB_ID = '2b5bf95f69cb801bb1e6f954490ed288';

async function testWeeklyPulseExport() {
  console.log('🔄 Testing WEEKLY_PULSE export to Notion...\n');

  // 1. Query Supabase
  console.log('Step 1: Querying dashboard_weekly_pulse view...');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { data, error } = await supabase
    .from('dashboard_weekly_pulse')
    .select('*');

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.error('❌ No data found in dashboard_weekly_pulse');
    return;
  }

  console.log(`✅ Data fetched (${data.length} rows):`);
  console.log(JSON.stringify(data, null, 2));

  // 2. Transform and create/update pages for each row
  console.log('\nStep 2: Processing rows...');
  const notion = new Client({ auth: env.NOTION_API_KEY });
  
  for (const row of data) {
    const properties = {
      'Period': { title: [{ text: { content: row.period } }] },
      'Page Views': { number: row.views || 0 },
      'Active Users': { number: row.active_users || 0 },
      'New Subscribers': { number: row.new_subscribers || 0 },
      'Views Growth': { number: row.views_change || 0 },
      'Subs Growth': { number: row.subs_change || 0 },
    };
    
    console.log(`\n📊 Processing: ${row.period}`);

    try {
      // Check if we should update or create
      if (row.period === 'Last 7 Days') {
        // Query for existing page using raw API
        const queryUrl = `https://api.notion.com/v1/databases/${WEEKLY_PULSE_DB_ID}/query`;
        const queryRes = await fetch(queryUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filter: {
              property: 'Period',
              title: { equals: 'Last 7 Days' }
            }
          })
        });
        const queryResponse = await queryRes.json();

        if (queryResponse.results && queryResponse.results.length > 0) {
          // Update existing page
          const pageId = queryResponse.results[0].id;
          await notion.pages.update({ page_id: pageId, properties });
          console.log('✅ UPDATED existing page:', pageId);
        } else {
          // Create new page
          const response = await notion.pages.create({
            parent: { database_id: WEEKLY_PULSE_DB_ID },
            properties
          });
          console.log('✅ CREATED page:', response.id);
        }
      } else {
        // Create new snapshot page
        const response = await notion.pages.create({
          parent: { database_id: WEEKLY_PULSE_DB_ID },
          properties
        });
        console.log('✅ CREATED snapshot page:', response.id);
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }

  console.log('\n🎉 All done!');
}

testWeeklyPulseExport();
