# Next.js Site Banner Setup Guide

## Overview

Your Next.js app reads banner data **directly from Cloudflare KV** using the REST API. The Worker only writes to KV when Airtable changes.

## Architecture

```
Airtable (you edit banner)
  ↓ (webhook)
Worker (writes to KV + Telegram notification)
  ↓
Cloudflare KV (global storage)
  ↓ (REST API read)
Next.js (displays banner)
```

## Setup

### 1. Create Cloudflare API Token

1. Go to: https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"** → Use template **"Read Account Resources"**
3. Permissions: `Account → Workers KV Storage → Read`
4. Copy token (you won't see it again)

### 2. Get Account ID

1. Go to: https://dash.cloudflare.com
2. Click any website → Copy **Account ID** from sidebar

### 3. Add Environment Variables

```bash
# .env.local (Next.js)
CLOUDFLARE_ACCOUNT_ID="your-account-id"
CLOUDFLARE_KV_NAMESPACE_ID="4139e07840974f19a2abe7630236ab11"
CLOUDFLARE_API_TOKEN="your-read-only-token"
```

For production (Vercel), add the same variables in project settings.

### 4. Read from KV

Create `lib/kv.ts`:

```typescript
const KV_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${process.env.CLOUDFLARE_KV_NAMESPACE_ID}`;

export async function getKVValue<T>(key: string): Promise<T | null> {
  try {
    const response = await fetch(`${KV_API_BASE}/values/${key}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      },
      next: { revalidate: 0 } // Disable Next.js cache for dynamic data
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('KV fetch error:', error);
    return null;
  }
}
```

### 5. Use in Components

```typescript
// Server component
import { getKVValue } from '@/lib/kv';

interface SiteBanner {
  enabled: boolean;
  type: 'info' | 'warning' | 'success' | 'promo';
  message: string;
  link?: string;
  linkText?: string;
  dismissible: boolean;
  expiresAt?: string;
}

export async function SiteBanner() {
  const banner = await getKVValue<SiteBanner>('site:banner');

  if (!banner?.enabled) return null;
  if (banner.expiresAt && new Date(banner.expiresAt) < new Date()) return null;

  return (
    <div className={`banner banner-${banner.type}`}>
      <p>{banner.message}</p>
      {banner.link && (
        <a href={banner.link}>{banner.linkText || 'Learn more'} →</a>
      )}
    </div>
  );
}
```

## KV Keys

- `site:banner` - Active site banner (auto-synced from Airtable)

## Benefits

✅ **Fast** - Direct KV read, no Worker invocation  
✅ **Global** - KV replicates worldwide  
✅ **Secure** - Read-only API token  
✅ **Dynamic** - Edit in Airtable, live instantly  
✅ **Notifications** - Telegram alerts when changes go live  

## Testing

Test KV access:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT/storage/kv/namespaces/4139e07840974f19a2abe7630236ab11/values/site:banner"
```
