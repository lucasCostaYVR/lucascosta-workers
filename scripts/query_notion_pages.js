import 'dotenv/config';
import { Client } from '@notionhq/client';

const env = process.env;
const notion = new Client({ auth: env.NOTION_API_KEY });

async function queryDatabase() {
  const databaseId = '2b5bf95f69cb801bb1e6f954490ed288';
  
  console.log('Querying database for pages...\n');
  
  const response = await notion.databases.query({
    database_id: databaseId,
  });
  
  console.log('Pages in database:');
  console.log(JSON.stringify(response, null, 2));
  
  if (response.results && response.results.length > 0) {
    console.log('\n\nFirst page properties:');
    console.log(JSON.stringify(response.results[0].properties, null, 2));
  }
}

queryDatabase().catch(console.error);
