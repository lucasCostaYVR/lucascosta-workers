#!/bin/bash

# Test analytics export notification locally
# This will trigger the CMS queue to export analytics to Notion

echo "🧪 Testing Analytics Export Notification..."
echo ""

# Send a job to the CMS queue (you'll need to use the queue endpoint or trigger it manually)
# For now, let's just send a test to the Telegram client directly

curl -X POST http://localhost:8787/test/telegram \
  -H "Content-Type: application/json" \
  -d '{
    "emoji": "📊",
    "title": "Analytics Sync Complete",
    "details": {
      "Database": "BLOG_ANALYTICS",
      "Rows": "4",
      "Created": "0",
      "Updated": "4"
    }
  }'

echo ""
echo "✅ Test sent! Check your Telegram for the notification."
