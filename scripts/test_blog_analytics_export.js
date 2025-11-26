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

const BLOG_POSTS_DB_ID = '2b4bf95f69cb80db9a23cfc97b4ff4ea';

async function testBlogAnalyticsExport() {
  console.log('🔄 Testing BLOG_ANALYTICS export to Notion...\n');

  // 1. Query Supabase
  console.log('Step 1: Querying dashboard_content_leaderboard view...');
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);
  const { data, error } = await supabase
    .from('dashboard_content_leaderboard')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Supabase error:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.error('❌ No data found in dashboard_content_leaderboard');
    return;
  }

  console.log(`✅ Data fetched (${data.length} posts with activity):`);
  data.forEach(row => {
    console.log(`  - ${row.title}: ${row.views} views, ${row.visitors} visitors, ${row.signups} signups`);
  });

  // 2. Transform and update pages
  console.log('\nStep 2: Processing posts...');
  const notion = new Client({ auth: env.NOTION_API_KEY });
  
  for (const row of data) {
    const properties = {
      'Slug': { rich_text: [{ text: { content: row.slug || '' } }] },
      'Views': { number: row.views || 0 },
      'Visitors': { number: row.visitors || 0 },
      'Signups': { number: row.signups || 0 },
      'Performance Score': { number: row.performance_score || 0 },
      'Conversion Rate': { number: row.conversion_rate_pct || 0 },
    };
    
    console.log(`\n📊 Processing: ${row.title}`);

    try {
      // Query for existing page by Slug
      const queryUrl = `https://api.notion.com/v1/databases/${BLOG_POSTS_DB_ID}/query`;
      const queryRes = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.NOTION_API_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: 'Slug',
            rich_text: { equals: row.slug }
          }
        })
      });
      const queryResponse = await queryRes.json();

      if (queryResponse.results && queryResponse.results.length > 0) {
        // Update existing page
        const pageId = queryResponse.results[0].id;
        await notion.pages.update({ page_id: pageId, properties });
        console.log(`✅ UPDATED: ${row.views} views, ${row.visitors} visitors, ${row.signups} signups`);
      } else {
        console.log('⚠️  Post not found in Notion (may not be published yet)');
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }

  console.log('\n🎉 All done!');
}

testBlogAnalyticsExport().catch(console.error);
