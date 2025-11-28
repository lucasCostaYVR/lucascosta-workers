# Site Banner Feature

Dynamic site-wide announcement banners managed via KV storage.

## Setup

### 1. Create KV Namespace

```bash
# Production
npx wrangler kv:namespace create SITE_SETTINGS

# Development (local)
npx wrangler kv:namespace create SITE_SETTINGS --preview
```

Copy the IDs from the output and add them to `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "SITE_SETTINGS",
    "id": "your-production-id",
    "preview_id": "your-preview-id"
  }
]
```

### 2. Set Admin Secret

```bash
# Add to .dev.vars for local development
echo 'ADMIN_SECRET="your-secure-random-string"' >> .dev.vars

# Add to Cloudflare secrets for production
npx wrangler secret put ADMIN_SECRET
```

## API Usage

### Get Active Banner (Public)

```bash
curl https://api.lucascosta.tech/api/banner
```

**Response:**
```json
{
  "banner": {
    "enabled": true,
    "type": "info",
    "message": "🚀 New: SFMC Automation Studio snippets now available!",
    "link": "/code-snippets?tag=automation-studio",
    "linkText": "View Snippets",
    "dismissible": true,
    "expiresAt": "2025-12-01T00:00:00Z"
  }
}
```

### Create/Update Banner (Protected)

```bash
curl -X POST https://api.lucascosta.tech/api/banner \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "type": "promo",
    "message": "🎉 Black Friday: Get 50% off premium snippets!",
    "link": "/pricing",
    "linkText": "Learn More",
    "dismissible": true,
    "expiresAt": "2025-11-30T23:59:59Z"
  }'
```

### Disable Banner (Protected)

```bash
curl -X DELETE https://api.lucascosta.tech/api/banner \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

## Banner Types

- **`info`**: Blue - General announcements
- **`warning`**: Yellow - Important notices
- **`success`**: Green - New features, achievements
- **`promo`**: Purple/Gradient - Sales, special offers

## Frontend Integration

```typescript
// In your Next.js layout or component
import { useEffect, useState } from 'react';

interface Banner {
  enabled: boolean;
  type: 'info' | 'warning' | 'success' | 'promo';
  message: string;
  link?: string;
  linkText?: string;
  dismissible: boolean;
}

export function SiteBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user dismissed this banner
    const dismissedBanner = localStorage.getItem('dismissed-banner');
    
    fetch('https://api.lucascosta.tech/api/banner')
      .then(res => res.json())
      .then(data => {
        if (data.banner && dismissedBanner !== data.banner.message) {
          setBanner(data.banner);
        }
      });
  }, []);

  const handleDismiss = () => {
    if (banner) {
      localStorage.setItem('dismissed-banner', banner.message);
      setDismissed(true);
    }
  };

  if (!banner || dismissed) return null;

  return (
    <div className={`banner banner-${banner.type}`}>
      <p>{banner.message}</p>
      {banner.link && (
        <a href={banner.link}>{banner.linkText || 'Learn More'}</a>
      )}
      {banner.dismissible && (
        <button onClick={handleDismiss}>×</button>
      )}
    </div>
  );
}
```

## Examples

### New Feature Announcement
```json
{
  "enabled": true,
  "type": "success",
  "message": "✨ New: AI-powered snippet recommendations are here!",
  "link": "/code-snippets",
  "linkText": "Try it now",
  "dismissible": true
}
```

### Maintenance Notice
```json
{
  "enabled": true,
  "type": "warning",
  "message": "⚠️ Scheduled maintenance: Dec 1, 2:00-4:00 AM UTC",
  "dismissible": false,
  "expiresAt": "2025-12-01T04:00:00Z"
}
```

### Limited-Time Promo
```json
{
  "enabled": true,
  "type": "promo",
  "message": "🎁 Holiday Sale: 30% off all courses - Ends Friday!",
  "link": "/courses",
  "linkText": "Shop Now",
  "dismissible": true,
  "expiresAt": "2025-12-06T23:59:59Z"
}
```

### Blog Post Highlight
```json
{
  "enabled": true,
  "type": "info",
  "message": "📝 New article: How I Built a Custom CDP with Cloudflare Workers",
  "link": "/blog/building-custom-cdp",
  "linkText": "Read Now",
  "dismissible": true
}
```
