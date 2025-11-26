import 'dotenv/config';
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

async function clearDatabase() {
  console.log('🗑️  Clearing all pages from Weekly Traffic Pulse database...\n');

  const notion = new Client({ auth: env.NOTION_API_KEY });

  // Query all pages
  const queryUrl = `https://api.notion.com/v1/databases/${WEEKLY_PULSE_DB_ID}/query`;
  const queryRes = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  const queryResponse = await queryRes.json();

  if (!queryResponse.results || queryResponse.results.length === 0) {
    console.log('✅ Database is already empty');
    return;
  }

  console.log(`Found ${queryResponse.results.length} pages to delete\n`);

  // Archive each page
  for (const page of queryResponse.results) {
    try {
      await notion.pages.update({
        page_id: page.id,
        archived: true
      });
      const title = page.properties.Period?.title?.[0]?.text?.content || 'Unknown';
      console.log(`✅ Archived: ${title}`);
    } catch (err) {
      console.error(`❌ Error archiving page ${page.id}:`, err.message);
    }
  }

  console.log('\n🎉 Database cleared!');
}

clearDatabase().catch(console.error);
