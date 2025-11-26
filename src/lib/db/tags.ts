import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Simple slugify function
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
}

/**
 * Reconciles tags for a post
 * 1. Ensures all tags exist in the `tags` table
 * 2. Updates the `post_tags` junction table to match the provided list
 */
export async function reconcilePostTags(
  supabase: SupabaseClient,
  postId: string,
  tagNames: string[]
): Promise<void> {
  if (!tagNames || tagNames.length === 0) {
    // If no tags, remove all associations
    await supabase.from('post_tags').delete().eq('post_id', postId);
    return;
  }

  // 1. Prepare tags for upsert
  const tagsToUpsert = tagNames.map(name => ({
    name,
    slug: slugify(name)
  }));

  // 2. Upsert tags and get their IDs
  // We use onConflict: 'name' to avoid duplicates
  const { data: upsertedTags, error: upsertError } = await supabase
    .from('tags')
    .upsert(tagsToUpsert, { onConflict: 'name' })
    .select('id, name');

  if (upsertError) {
    console.error('Error upserting tags:', upsertError);
    throw new Error(`Failed to upsert tags: ${upsertError.message}`);
  }

  if (!upsertedTags) return;

  // 3. Prepare post_tags associations
  const tagIds = upsertedTags.map(t => t.id);
  const postTagsToInsert = tagIds.map(tagId => ({
    post_id: postId,
    tag_id: tagId
  }));

  // 4. Replace existing associations
  // Transaction-like behavior: Delete all for this post, then insert new ones
  // Note: In a real transaction this would be safer, but for this worker flow it's acceptable
  
  const { error: deleteError } = await supabase
    .from('post_tags')
    .delete()
    .eq('post_id', postId);

  if (deleteError) {
    console.error('Error clearing post tags:', deleteError);
    throw new Error(`Failed to clear post tags: ${deleteError.message}`);
  }

  if (postTagsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('post_tags')
      .insert(postTagsToInsert);

    if (insertError) {
      console.error('Error inserting post tags:', insertError);
      throw new Error(`Failed to insert post tags: ${insertError.message}`);
    }
  }
}
