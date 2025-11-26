const WORKER_URL_RESEND_PAYLOADS = 'http://localhost:8787/webhooks/resend?key=G1R1GEwAH70gkkOsHxZza02o5rZBcBXJ';

async function testResendPayloads() {
  console.log('🧪 Starting Resend Payload Tests...\n');

  const payloads = [
    {
      name: 'Email Bounced',
      payload: {
        "type": "email.bounced",
        "created_at": "2024-11-22T23:41:12.126Z",
        "data": {
          "broadcast_id": "8b146471-e88e-4322-86af-016cd36fd216",
          "created_at": "2024-11-22T23:41:11.894719+00:00",
          "email_id": "56761188-7520-42d8-8898-ff6fc54ce618",
          "from": "Acme <onboarding@resend.dev>",
          "to": ["delivered@resend.dev"],
          "subject": "Sending this example",
          "template_id": "43f68331-0622-4e15-8202-246a0388854b",
          "bounce": {
            "message": "The recipient's email address is on the suppression list because it has a recent history of producing hard bounces.",
            "subType": "Suppressed",
            "type": "Permanent"
          },
          "tags": {
            "category": "confirm_email"
          }
        }
      }
    },
    {
      name: 'Contact Created',
      payload: {
        "type": "contact.created",
        "created_at": "2024-11-17T19:32:22.980Z",
        "data": {
          "id": "e169aa45-1ecf-4183-9955-b1499d5701d3",
          "audience_id": "78261eea-8f8b-4381-83c6-79fa7120f1cf",
          "segment_ids": ["78261eea-8f8b-4381-83c6-79fa7120f1cf"],
          "created_at": "2024-11-17T19:32:22.980Z",
          "updated_at": "2024-11-17T19:32:22.980Z",
          "email": "steve.wozniak@gmail.com",
          "first_name": "Steve",
          "last_name": "Wozniak",
          "unsubscribed": false
        }
      }
    }
  ];

  for (const test of payloads) {
    console.log(`Testing: ${test.name}`);
    const res = await fetch(WORKER_URL_RESEND_PAYLOADS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test.payload)
    });

    console.log(`  Status: ${res.status}`);
    const text = await res.text();
    console.log(`  Response: ${text}`);
    
    if (res.status !== 200) {
        console.error(`❌ Failed ${test.name}`);
        throw new Error('Test failed');
    }
    console.log('✅ Passed\n');
  }
}

testResendPayloads().catch(console.error);
