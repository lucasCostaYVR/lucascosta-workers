#!/bin/bash

# Usage: ./test-webhook.sh [PAGE_ID]
# Defaults to the ID from the logs if not provided

PAGE_ID=${1:-"2b4bf95f-69cb-8092-b653-e15a0fdb8ef4"}
WEBHOOK_KEY="G1R1GEwAH70gkkOsHxZza02o5rZBcBXJ"

curl -X POST "http://localhost:8787/webhooks/notion?key=$WEBHOOK_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-event-id",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "entity": {
      "id": "'$PAGE_ID'",
      "type": "page"
    },
    "type": "page.updated"
  }'
