#!/bin/bash

# Test contact form event locally
# Make sure wrangler dev is running first!

# Use a random email to avoid duplicate key errors
RANDOM_EMAIL="test$(date +%s)@example.com"

curl -X POST http://localhost:8787/events/ingest \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: G1R1GEwAH70gkkOsHxZza02o5rZBcBXJ" \
  -d "{
  \"name\": \"contact.submitted\",
  \"user\": {
    \"email\": \"$RANDOM_EMAIL\",
    \"name\": \"John Doe Test\"
  },
  \"properties\": {
    \"subject\": \"Test Subject\",
    \"message\": \"This is a test message from curl\",
    \"source\": \"contact_page\"
  },
  \"context\": {
    \"page\": {
      \"path\": \"/contact\",
      \"url\": \"http://localhost:3000/contact\",
      \"referrer\": \"\"
    },
    \"userAgent\": \"curl/test\",
    \"locale\": \"en-US\",
    \"source\": \"test-script\"
  },
  \"anonymousId\": \"anon_test_$(date +%s)\"
}"

echo ""
echo "✅ Event sent with email: $RANDOM_EMAIL"
echo "Check wrangler dev logs and your Telegram for notification."
