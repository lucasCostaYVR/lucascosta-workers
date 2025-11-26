# Frontend Instructions: Tags System Implementation

We have upgraded the blog's backend to support a relational tags system. This allows for more robust tag management, "Tag Pages" (e.g., `/tags/engineering`), and better querying.

## Database Schema & Relationships

We are using Supabase (PostgreSQL).

### Tables

1.  **`posts`**
    *   `id` (UUID): Primary Key.
    *   `slug` (Text): URL slug (e.g., "my-first-post").
    *   `title` (Text): Post title.
    *   `summary` (Text): Short description/excerpt.
    *   `content_mdx` (Text): The full Markdown/MDX content.
    *   `featured_image` (Text): URL to the featured image (hosted on R2).
    *   `published_at` (Timestamp): When the post was published.
    *   `tags` (Text[]): *Legacy/Simple* array of tag names. You can use this for simple display if you don't need links.

2.  **`tags`**
    *   `id` (UUID): Primary Key.
    *   `name` (Text): Display name (e.g., "Software Engineering").
    *   `slug` (Text): URL-friendly slug (e.g., "software-engineering").

3.  **`post_tags`** (Junction Table)
    *   `post_id` (UUID): Foreign Key to `posts.id`.
    *   `tag_id` (UUID): Foreign Key to `tags.id`.

### Relationships

*   **Posts** have a **Many-to-Many** relationship with **Tags** through `post_tags`.

## Querying Data (Supabase Client)

### 1. Fetching Posts with Tags
To display tags on a post card or post detail page with links to the tag page.

```typescript
const { data: posts } = await supabase
  .from('posts')
  .select(`
    *,
    tags:post_tags(
      tag:tags(
        name,
        slug
      )
    )
  `)
  .eq('status', 'published');

// Data structure result:
// post.tags = [
//   { tag: { name: 'Tech', slug: 'tech' } },
//   { tag: { name: 'News', slug: 'news' } }
// ]
```

**Tip:** Don't forget to order your posts!
```typescript
  .order('published_at', { ascending: false })
```

### 2. Fetching a Tag Page (e.g., `/tags/[slug]`)
To show all posts belonging to a specific tag.

```typescript
// 1. Get the tag details
const { data: tag } = await supabase
  .from('tags')
  .select('*')
  .eq('slug', params.slug)
  .single();

// 2. Get posts for this tag
const { data: posts } = await supabase
  .from('posts')
  .select(`
    *,
    post_tags!inner(tag_id) 
  `)
  .eq('post_tags.tag_id', tag.id)
  .eq('status', 'published');
```

### 3. Fetching All Tags (e.g., `/tags` Index)
To show a cloud or list of all available topics.

```typescript
const { data: tags } = await supabase
  .from('tags')
  .select('*')
  .order('name');
```

## Frontend Tasks

1.  **Update Post Component**:
    *   Update the logic that renders tags to use the relational data if available.
    *   Link each tag to `/tags/[slug]`.

2.  **Create Tag Page (`app/tags/[slug]/page.tsx`)**:
    *   Fetch the tag by slug.
    *   Fetch all published posts associated with that tag.
    *   Render the list of posts (reuse your existing PostList/PostCard components).
    *   Add proper SEO metadata (Title: "Posts tagged [Name]").

3.  **Create Tags Index (`app/tags/page.tsx`)** (Optional):
    *   List all tags.
    *   Link to their respective tag pages.

## Notes
*   The `posts.tags` array column still exists and is populated. You can use it for simple fallbacks, but prefer the relational query for proper linking.
