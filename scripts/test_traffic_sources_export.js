import 'dotenv/config';
import { Client } from '@notionhq/client';
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

const TRAFFIC_SOURCES_DB_ID = '6668a5abb4b54e95a81466495b2f9879';

async function testTrafficSourcesExport() {
  console.log('🔄 Testing TRAFFIC_SOURCES export to Notion...\n');

  // 1. Query Supabase
  console.log('Step 1: Querying dashboard_traffic_sources view...');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { data, error } = await supabase
    .from('dashboard_traffic_sources')
    .select('*');

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.error('❌ No data found in dashboard_traffic_sources');
    return;
  }

  console.log(`✅ Data fetched (${data.length} sources):`);
  console.log(JSON.stringify(data, null, 2));

  // 2. Transform and create/update pages for each source
  console.log('\nStep 2: Processing sources...');
  const notion = new Client({ auth: env.NOTION_API_KEY });
  
  for (const row of data) {
    const properties = {
      'Source': { title: [{ text: { content: row.source_category || 'Unknown' } }] },
      'Visits': { number: row.visit_count || 0 },
      'Unique Visitors': { number: row.unique_visitors || 0 },
      'Conversions': { number: row.conversions || 0 },
      'Conversion Rate': { number: row.conversion_rate_pct || 0 },
    };
    
    console.log(`\n📊 Processing: ${row.source_category}`);

    try {
      // Query for existing page using raw API
      const queryUrl = `https://api.notion.com/v1/databases/${TRAFFIC_SOURCES_DB_ID}/query`;
      const queryRes = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: 'Source',
            title: { equals: row.source_category }
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
          parent: { database_id: TRAFFIC_SOURCES_DB_ID },
          properties
        });
        console.log('✅ CREATED page:', response.id);
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }

  console.log('\n🎉 All done!');
}

testTrafficSourcesExport().catch(console.error);
