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

const TRAFFIC_SOURCES_DB_ID = '6668a5abb4b54e95a81466495b2f9879';

async function inspectDatabase() {
  console.log('🔍 Inspecting Traffic Sources database...\n');

  const notion = new Client({ auth: env.NOTION_API_KEY });

  const database = await notion.databases.retrieve({
    database_id: TRAFFIC_SOURCES_DB_ID
  });

  console.log('Database properties:');
  console.log(JSON.stringify(database.properties, null, 2));
}

inspectDatabase().catch(console.error);
