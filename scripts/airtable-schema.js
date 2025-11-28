#!/usr/bin/env node

/**
 * Airtable Schema Inspector
 * Fetches and displays all tables and fields in your base
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appZNXVXQoH5pnZlO';

if (!AIRTABLE_API_KEY) {
  console.error('❌ AIRTABLE_API_KEY not found in environment');
  process.exit(1);
}

async function fetchSchema() {
  const response = await fetch(`https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`, {
    headers: {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    }
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('❌ Failed to fetch schema:', error);
    process.exit(1);
  }

  const data = await response.json();
  
  console.log('\n📊 Airtable Base Schema\n');
  console.log(`Base ID: ${BASE_ID}\n`);
  
  data.tables.forEach(table => {
    console.log(`\n📋 Table: ${table.name}`);
    console.log(`   ID: ${table.id}`);
    console.log(`   Primary Field: ${table.primaryFieldId}`);
    console.log(`   Fields:`);
    
    table.fields.forEach(field => {
      console.log(`      - ${field.name} (${field.type}) [${field.id}]`);
      if (field.options) {
        if (field.options.choices) {
          console.log(`        Choices: ${field.options.choices.map(c => c.name).join(', ')}`);
        }
      }
    });
  });
  
  console.log('\n\n✅ Schema fetched successfully!\n');
}

fetchSchema().catch(console.error);
