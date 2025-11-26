const WORKER_URL_RESEND_NULLS = 'http://localhost:8787/webhooks/resend?key=G1R1GEwAH70gkkOsHxZza02o5rZBcBXJ';

async function testResendNulls() {
  console.log('🧪 Starting Resend Null Fields Test...\n');

  const payload = {
    "type": "contact.created",
    "created_at": "2024-11-22T23:41:12.126Z",
    "data": {
      "id": "contact_123",
      "audience_id": "audience_123",
      "email": "nullnames@example.com",
      "first_name": null,
      "last_name": null,
      "unsubscribed": false
    }
  };

  console.log('Sending payload with null names...');
  const res = await fetch(WORKER_URL_RESEND_NULLS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log(`  Status: ${res.status}`);
  const text = await res.text();
  console.log(`  Response: ${text}`);
  
  if (res.status !== 200) {
      console.error('❌ Failed: Should accept null names');
      process.exit(1);
  }
  console.log('✅ Passed\n');
}

testResendNulls().catch(console.error);
