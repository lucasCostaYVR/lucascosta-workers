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

async function searchDatabases() {
  const notion = new Client({ auth: env.NOTION_API_KEY });
  
  try {
    const response = await notion.search({
      filter: { property: 'object', value: 'database' },
      page_size: 20
    });
    
    console.log('Found databases:');
    console.log('----------------');
    for (const db of response.results) {
      const title = db.title?.[0]?.plain_text || 'Untitled';
      console.log(`${title}: ${db.id.replace(/-/g, '')}`);
      
      // Show properties if they exist
      if (db.properties) {
        console.log('  Properties:');
        for (const [name, prop] of Object.entries(db.properties)) {
          console.log(`    - ${name} (${prop.type})`);
        }
      }
      console.log('');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

searchDatabases();
