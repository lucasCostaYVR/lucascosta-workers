const WORKER_URL_RESEND_UNSUB = 'http://localhost:8787/webhooks/resend?key=G1R1GEwAH70gkkOsHxZza02o5rZBcBXJ';

async function testResendUnsubscribe() {
  console.log('🧪 Starting Resend Unsubscribe Test...\n');

  const payload = {
    "type": "contact.updated",
    "created_at": new Date().toISOString(),
    "data": {
      "id": "contact_unsub_123",
      "audience_id": "audience_123",
      "email": "unsub-test@example.com",
      "unsubscribed": true
    }
  };

  console.log('Sending contact.updated (unsubscribed=true)...');
  const res = await fetch(WORKER_URL_RESEND_UNSUB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  console.log(`  Status: ${res.status}`);
  const text = await res.text();
  console.log(`  Response: ${text}`);
  
  if (res.status !== 200) {
      console.error('❌ Failed');
      process.exit(1);
  }
  console.log('✅ Passed. Check worker logs for "Processing unsubscribe/bounce for Ghost sync"');
}

testResendUnsubscribe().catch(console.error);
