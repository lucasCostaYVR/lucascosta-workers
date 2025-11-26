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

async function queryDatabase() {
  const notion = new Client({ auth: env.NOTION_API_KEY });
  
  try {
    // Try to query existing pages to infer schema
    const response = await notion.databases.query({ 
      database_id: WEEKLY_PULSE_DB_ID,
      page_size: 1
    });
    
    console.log('Query Response:');
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.body) console.error('Body:', error.body);
  }
}

queryDatabase();
