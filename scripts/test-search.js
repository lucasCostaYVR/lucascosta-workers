#!/usr/bin/env node

/**
 * Test Search Functionality
 * Tests both snippets and posts full-text search
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testSearch() {
  const query = process.argv[2] || 'react';
  
  console.log(`\n🔍 Testing search for: "${query}"\n`);

  // 1. Check what posts exist
  console.log('📊 Checking posts in database...');
  const { data: allPosts, error: postsError } = await supabase
    .from('posts')
    .select('id, title, slug, status, published_at')
    .limit(5);

  if (postsError) {
    console.error('❌ Error fetching posts:', postsError);
  } else {
    console.log(`✅ Found ${allPosts?.length || 0} posts total`);
    allPosts?.forEach(p => {
      console.log(`   - ${p.title} (${p.status})`);
    });
  }

  // 2. Test posts search
  console.log(`\n🔍 Searching posts for "${query}"...`);
  const { data: searchResults, error: searchError } = await supabase
    .from('posts')
    .select('id, title, summary, slug, published_at, status')
    .textSearch('search_vector', query, { type: 'websearch' })
    .eq('status', 'published');

  if (searchError) {
    console.error('❌ Search error:', searchError);
  } else {
    console.log(`✅ Found ${searchResults?.length || 0} matching posts`);
    searchResults?.forEach(p => {
      console.log(`   - ${p.title} (${p.slug})`);
    });
  }

  // 3. Test snippets search
  console.log(`\n🔍 Searching snippets for "${query}"...`);
  const { data: snippetResults, error: snippetError } = await supabase
    .from('snippets')
    .select('id, title, category, slug')
    .textSearch('search_vector', query, { type: 'websearch' })
    .eq('status', 'published');

  if (snippetError) {
    console.error('❌ Search error:', snippetError);
  } else {
    console.log(`✅ Found ${snippetResults?.length || 0} matching snippets`);
    snippetResults?.forEach(s => {
      console.log(`   - ${s.title} (${s.category})`);
    });
  }

  // 4. Test raw SQL search on posts
  console.log(`\n🔍 Testing raw SQL search on posts...`);
  const { data: sqlResults, error: sqlError } = await supabase
    .rpc('search_posts', { search_query: query })
    .limit(5);

  if (sqlError) {
    console.log('ℹ️  No RPC function (expected):', sqlError.message);
    
    // Try direct query
    console.log('\n🔍 Testing direct SQL query...');
    const { data: directResults, error: directError } = await supabase
      .from('posts')
      .select('*')
      .limit(1);
    
    if (directError) {
      console.error('❌ Direct query error:', directError);
    } else {
      const post = directResults?.[0];
      console.log('✅ Sample post:');
      console.log('   Title:', post?.title);
      console.log('   Status:', post?.status);
      console.log('   Has content_mdx:', !!post?.content_mdx);
      console.log('   Has search_vector:', !!post?.search_vector);
    }
  }
}

testSearch().catch(console.error);
