// Script to inspect a Notion page and see what it contains
import { config } from 'dotenv';
import { Client } from '@notionhq/client';

config({ path: '.dev.vars' });

const pageId = process.argv[2] || '2b6bf95f-69cb-8164-aeab-c2b78ff7759c';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

async function inspectPage() {
  try {
    console.log(`\n🔍 Inspecting Notion page: ${pageId}\n`);
    
    const page = await notion.pages.retrieve({ page_id: pageId });
    
    console.log('📄 Page Details:');
    console.log('─'.repeat(60));
    console.log(`ID: ${page.id}`);
    console.log(`Created: ${page.created_time}`);
    console.log(`Last edited: ${page.last_edited_time}`);
    console.log(`Archived: ${page.archived}`);
    console.log(`\nParent:`);
    console.log(JSON.stringify(page.parent, null, 2));
    
    if ('properties' in page) {
      console.log(`\n📋 Properties:`);
      console.log('─'.repeat(60));
      
      for (const [key, value] of Object.entries(page.properties)) {
        console.log(`\n${key}:`);
        console.log(JSON.stringify(value, null, 2));
      }
    }
    
    // Check which database this belongs to
    if (page.parent.type === 'database_id') {
      console.log(`\n🗄️  Parent Database ID: ${page.parent.database_id}`);
      console.log(`\n🔍 Checking if this is a blog post database...`);
      const blogPostsDb = '2b4bf95f69cb80db9a23cfc97b4ff4ea';
      if (page.parent.database_id.replace(/-/g, '') === blogPostsDb.replace(/-/g, '')) {
        console.log('✅ This IS from the blog posts database');
      } else {
        console.log('❌ This is NOT from the blog posts database');
        console.log(`   Expected: ${blogPostsDb}`);
        console.log(`   Got:      ${page.parent.database_id}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 'object_not_found') {
      console.log('\nThis page may have been deleted or you don\'t have access to it.');
    }
  }
}

inspectPage();
