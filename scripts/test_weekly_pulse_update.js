import 'dotenv/config';
import { Client } from '@notionhq/client';
import { createClient } from '@supabase/supabase-js';

const env = process.env;
const notion = new Client({ auth: env.NOTION_API_KEY });
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testWeeklyPulseUpdate() {
  const databaseId = '2b5bf95f69cb801bb1e6f954490ed288';

  console.log('🔄 Testing WEEKLY_PULSE update to Notion...\n');

  // 1. Query Supabase
  console.log('Step 1: Querying dashboard_weekly_pulse view...');
  const { data, error } = await supabase
    .from('dashboard_weekly_pulse')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  console.log('✅ Data fetched:');
  console.log(JSON.stringify(data, null, 2));

  // 2. Query Notion database for existing page
  console.log('\nStep 2: Querying Notion database for existing page...');
  const queryResponse = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: 'Period',
      title: { equals: 'Last 7 Days' }
    }
  });

  let pageId;
  if (queryResponse.results.length > 0) {
    pageId = queryResponse.results[0].id;
    console.log('✅ Found existing page:', pageId);
  } else {
    console.log('⚠️ No existing page found, will create new one');
  }

  // 3. Transform to Notion format
  console.log('\nStep 3: Transforming to Notion format...');
  const properties = {
    'Period': { title: [{ text: { content: data.period || 'Last 7 Days' } }] },
    'Page Views': { number: data.views || 0 },
    'Active Users': { number: data.active_users || 0 },
    'New Subscribers': { number: data.new_subscribers || 0 },
    'Views Growth': { number: data.views_change || 0 },
    'Subs Growth': { number: data.subs_change || 0 },
  };
  console.log('✅ Notion properties:');
  console.log(JSON.stringify(properties, null, 2));

  // 4. Update or Create page
  if (pageId) {
    console.log('\nStep 4: Updating existing page...');
    const response = await notion.pages.update({
      page_id: pageId,
      properties
    });
    console.log('✅ SUCCESS! Page updated:', response.id);
    console.log('URL:', response.url);
  } else {
    console.log('\nStep 4: Creating new page...');
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties
    });
    console.log('✅ SUCCESS! Page created:', response.id);
    console.log('URL:', response.url);
  }
}

testWeeklyPulseUpdate().catch(console.error);
