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

const DASHBOARD_PAGE_ID = '2b5bf95f69cb809089c1fe2d098e13fc';

async function createTrafficSourcesDatabase() {
  console.log('🚀 Creating Traffic Sources database in Notion...\n');

  const notion = new Client({ auth: env.NOTION_API_KEY });

  try {
    const database = await notion.databases.create({
      parent: {
        type: 'page_id',
        page_id: DASHBOARD_PAGE_ID
      },
      title: [
        {
          type: 'text',
          text: {
            content: 'Traffic Sources'
          }
        }
      ],
      properties: {
        'Source': {
          title: {}
        },
        'Visits': {
          number: {
            format: 'number'
          }
        },
        'Unique Visitors': {
          number: {
            format: 'number'
          }
        }
      }
    });

    console.log('✅ Database created successfully!');
    console.log('Database ID:', database.id);
    console.log('URL:', database.url);
    console.log('\n📋 Add this to your cms-mapping.ts:');
    console.log(`    notionDatabaseId: '${database.id.replace(/-/g, '')}',`);
    
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    console.error('Full error:', error);
  }
}

createTrafficSourcesDatabase().catch(console.error);
