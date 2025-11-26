# Database Schema Documentation

This document reflects the **LIVE** database structure as of November 24, 2025.

## 1. Identity & Profiles

The core of the CDP. We use a "Graph-based" identity system where multiple identities (Email, Cookie ID) point to a single Profile.

### `profiles`
The master record for a user.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key. The canonical User ID. |
| `email` | Text | Unique email address (nullable for anonymous users). |
| `name` | Text | User's full name. |
| `status` | Text | Membership status (e.g., 'free', 'premium'). |
| `anonymous_id` | Text | **Legacy/Fallback**. The first anonymous ID seen. |
| `user_id` | Text | External User ID (if any). |
| `first_name` | Text | Parsed first name. |
| `source` | Text | Origin source (e.g., 'web', 'ghost'). |
| `created_at` | Timestamp | When the profile was first created. |
| `updated_at` | Timestamp | Last update. |

### `identity_graph`
The link between various identifiers and the Profile.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key. |
| `profile_id` | UUID | FK to `profiles.id`. |
| `identity_type` | Text | Type of ID: `email`, `anonymous_id`, `user_id`. |
| `identity_value` | Text | The actual value (e.g., `lucas@example.com`). |
| `first_seen_at` | Timestamp | When this specific identity was first tracked. |
| `last_seen_at` | Timestamp | When this identity was last active. |

---

## 2. Event Log

The immutable ledger of all user actions.

### `marketing_events`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key. |
| `type` | Text | Event name (e.g., `page_view`, `contact.submitted`). |
| `source` | Text | Source system (`web`, `resend`, `ghost`). |
| `occurred_at` | Timestamp | Client-side timestamp of the event. |
| `ingested_at` | Timestamp | Server-side timestamp when processed. |
| `identity_type` | Text | The identity type used for this event. |
| `identity_value` | Text | The identity value used for this event. |
| `traits` | JSONB | Flattened event properties & context. |
| `raw` | JSONB | The full original payload for debugging. |
| `correlation_id` | Text | ID to trace events across systems. |
| `meta` | JSONB | System metadata (processing time, worker ID). |

---

## 3. Content Management (CMS)

Synced from Notion via the `cms-sync` worker.

### `posts`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key. |
| `notion_id` | Text | The original Notion Page ID. |
| `slug` | Text | URL slug (e.g., `my-first-post`). |
| `title` | Text | Post title. |
| `summary` | Text | Short excerpt for cards/SEO. |
| `content_mdx` | Text | The full content converted to MDX. |
| `status` | Text | `published` or `draft`. |
| `published_at` | Timestamp | Publication date. |
| `featured_image` | Text | URL to the cover image. |
| `tags` | JSONB | Cached array of tags (denormalized). |
| `last_synced_at` | Timestamp | When the sync worker last touched this. |

### `tags`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key. |
| `name` | Text | Display name (e.g., "Engineering"). |
| `slug` | Text | URL slug (e.g., "engineering"). |

### `post_tags`
Junction table for Many-to-Many relationship.
| Column | Type | Description |
| :--- | :--- | :--- |
| `post_id` | UUID | FK to `posts.id`. |
| `tag_id` | UUID | FK to `tags.id`. |

---

## 4. Engagement & Community

### `comments`
User comments on blog posts.
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key. |
| `post_id` | UUID | FK to `posts.id`. |
| `profile_id` | UUID | FK to `profiles.id` (The author). |
| `parent_comment_id`| UUID | Self-reference for nested replies. |
| `content` | Text | The comment text. |
| `is_edited` | Boolean | True if the comment has been modified. |
| `is_deleted` | Boolean | Soft-delete flag. |

### `email_subscriptions`
Newsletter subscription status.
| Column | Type | Description |
| :--- | :--- | :--- |
| `profile_id` | UUID | FK to `profiles.id`. |
| `subscribed` | Boolean | Current status. |
| `source` | Text | Where they subscribed (e.g., `footer`, `popup`). |
| `subscribed_at` | Timestamp | When they joined. |
| `unsubscribed_at`| Timestamp | When they left (if applicable). |
