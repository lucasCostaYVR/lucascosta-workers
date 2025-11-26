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

async function inspectDatabase() {
  const notion = new Client({ auth: env.NOTION_API_KEY });
  
  try {
    const database = await notion.databases.retrieve({ database_id: WEEKLY_PULSE_DB_ID });
    
    console.log('Full Database Response:');
    console.log(JSON.stringify(database, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

inspectDatabase();
