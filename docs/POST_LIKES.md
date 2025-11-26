# Post Likes Integration Guide

## Overview

Users (both anonymous and authenticated) can like blog posts. Likes are tracked in the `post_likes` table and linked to user profiles via the identity resolution system.

## Database Schema

```sql
-- Post likes table
CREATE TABLE post_likes (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  profile_id UUID REFERENCES profiles(id),
  identity_type TEXT,  -- 'anonymous_id' or 'email'
  identity_value TEXT, -- 'anon_xyz' or 'user@example.com'
  created_at TIMESTAMPTZ
);

-- Posts table has denormalized like_count for performance
ALTER TABLE posts ADD COLUMN like_count INTEGER DEFAULT 0;
```

## Event Structure

### Like a Post

Send a **WebEvent** with `name: 'post.liked'` to `/events/ingest`:

```typescript
// Server Action example (Next.js)
'use server'

import { headers } from 'next/headers';

export async function likePost(
  postId: string, 
  postSlug: string, 
  postTitle: string,
  pathname: string
) {
  const userEmail = await getCurrentUserEmail(); // Your auth logic

  const event = {
    name: 'post.liked',
    context: {
      page: {
        path: pathname,
        url: `${process.env.NEXT_PUBLIC_SITE_URL}${pathname}`,
        title: postTitle
      },
      userAgent: headers().get('user-agent') || '',
      locale: 'en-US'
    },
    properties: {
      post_id: postId,
      post_slug: postSlug,
      post_title: postTitle
    },
    user: userEmail ? {
      email: userEmail
    } : undefined
  };

  const response = await fetch(`${process.env.WORKER_URL}/events/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': process.env.WEBHOOK_SECRET!,
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error('Failed to like post');
  }

  return response.json(); // { status: "OK", anonymousId: "anon_xyz" }
}
```

### Unlike a Post (Optional)

```typescript
export async function unlikePost(postId: string, pathname: string) {
  const userEmail = await getCurrentUserEmail();

  const event = {
    name: 'post.unliked',
    context: {
      page: {
        path: pathname,
        url: `${process.env.NEXT_PUBLIC_SITE_URL}${pathname}`
      },
      userAgent: headers().get('user-agent') || '',
      locale: 'en-US'
    },
    properties: {
      post_id: postId
    },
    user: userEmail ? {
      email: userEmail
    } : undefined
  };

  await fetch(`${process.env.WORKER_URL}/events/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': process.env.WEBHOOK_SECRET!,
    },
    body: JSON.stringify(event),
  });
}
```

## Response Structure

The `/events/ingest` endpoint returns:

```json
{
  "status": "OK",
  "anonymousId": "anon_xyz"
}
```

**Note:** The actual like processing happens asynchronously in the queue. The response confirms the event was queued, not that the like was recorded.

## Client Component Example

```typescript
'use client'

import { useState } from 'react'
import { likePost } from '@/app/actions/posts'

export function LikeButton({ 
  postId, 
  postSlug, 
  postTitle, 
  initialLikes = 0,
  initialLiked = false 
}: {
  postId: string
  postSlug: string
  postTitle: string
  initialLikes?: number
  initialLiked?: boolean
}) {
  const [likes, setLikes] = useState(initialLikes)
  const [isLiked, setIsLiked] = useState(initialLiked)
  const [isLoading, setIsLoading] = useState(false)

  const handleLike = async () => {
    if (isLoading || isLiked) return

    setIsLoading(true)
    try {
      const result = await likePost(postId, postSlug, postTitle)
      
      if (result.success) {
        setIsLiked(true)
        setLikes(result.like_count || likes + 1)
      }
    } catch (error) {
      console.error('Failed to like post:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleLike}
      disabled={isLoading || isLiked}
      className={isLiked ? 'liked' : ''}
    >
      ❤️ {likes}
    </button>
  )
}
```

## Checking if User Already Liked

Query the `post_likes` table on page load:

```typescript
// Server component or API route
import { createClient } from '@supabase/supabase-js'

export async function checkIfLiked(postId: string, identityValue: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  )

  // Get profile_id for this identity
  const { data: identity } = await supabase
    .from('identity_graph')
    .select('profile_id')
    .eq('identity_value', identityValue)
    .single()

  if (!identity) return false

  // Check if they liked this post
  const { data: like } = await supabase
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('profile_id', identity.profile_id)
    .single()

  return !!like
}
```

## Identity Resolution

When an anonymous user signs up, their likes are automatically linked to their profile:

- Anonymous user (`anon_xyz`) likes 3 posts
- User signs up with email
- `merge_anonymous_to_email()` function is called
- All 3 likes now belong to the identified profile
- Constraint prevents duplicate likes if they try to like again

## Analytics

All like events are stored in `marketing_events` table for analytics:

```sql
SELECT 
  traits->>'post_slug' as post,
  COUNT(*) as total_likes,
  COUNT(DISTINCT identity_value) as unique_likers
FROM marketing_events
WHERE type = 'post.liked'
GROUP BY traits->>'post_slug'
ORDER BY total_likes DESC;
```

## Notes

- **One like per profile per post**: Enforced by `UNIQUE(profile_id, post_id)` constraint
- **Denormalized count**: `posts.like_count` is kept in sync via database triggers
- **Anonymous support**: Works seamlessly for logged-out users
- **Idempotent**: Sending duplicate like events returns `already_liked: true`
