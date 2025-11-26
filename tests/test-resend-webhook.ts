const WORKER_URL_RESEND = 'http://localhost:8787/webhooks/resend?key=G1R1GEwAH70gkkOsHxZza02o5rZBcBXJ';

async function testResendWebhook() {
  console.log('🧪 Starting Resend Webhook Test...\n');

  const payload = {
    type: 'email.bounced',
    created_at: new Date().toISOString(),
    data: {
      created_at: new Date().toISOString(),
      email_id: 'test_email_id_123',
      from: 'onboarding@resend.dev',
      to: ['bounced@example.com'],
      subject: 'Hello World',
      bounce: {
        id: 'bounce_123',
        type: 'hard_bounce',
        message: 'Address not found'
      }
    }
  };

  console.log('Sending Resend webhook:', JSON.stringify(payload, null, 2));

  const res = await fetch(WORKER_URL_RESEND, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log('Response status:', res.status);
  const text = await res.text();
  console.log('Response body:', text);

  if (res.status === 200) {
    console.log('\n✅ Resend webhook accepted successfully.');
  } else {
    console.error('\n❌ Resend webhook failed.');
  }
}

testResendWebhook().catch(console.error);
