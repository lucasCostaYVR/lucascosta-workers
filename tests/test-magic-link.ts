const WORKER_URL_MAGIC = 'http://localhost:8787/events/ingest';
const TEST_PROFILE_ID = '550e8400-e29b-41d4-a716-446655440000'; // Fake UUID

async function testMagicLink() {
  console.log('🧪 Starting Magic Link Test...\n');

  // ---------------------------------------------------------
  // TEST: Magic Link Identification
  // Simulates a user clicking a link with ?uid=...
  // ---------------------------------------------------------
  console.log('Test: Magic Link Click');
  
  // 1. First, simulate the "identify" event that the pixel sends
  // when it detects ?uid=...
  const res1 = await fetch(WORKER_URL_MAGIC, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tracking-Consent': 'granted',
      'Origin': 'https://lucascosta.tech'
    },
    body: JSON.stringify({
      name: 'identify',
      timestamp: new Date().toISOString(),
      // The pixel sends profile_id in the user object
      user: {
        profile_id: TEST_PROFILE_ID
      },
      context: { page: { url: `https://lucascosta.tech/?uid=${TEST_PROFILE_ID}` } },
      properties: {}
    })
  });

  const data1 = await res1.json() as { anonymousId: string };
  const cookie1 = res1.headers.get('set-cookie');

  console.log('  Response:', res1.status);
  console.log('  Cookie:', cookie1 ? '✅ Present' : '❌ Missing');
  console.log('  Anon ID:', data1.anonymousId);

  if (!cookie1) throw new Error('Should set cookie');
  
  console.log('\n✅ Magic Link event sent successfully.');
  console.log('   Check your Supabase logs/tables to verify that:');
  console.log(`   1. A new entry in 'identity_graph' links anonymous_id '${data1.anonymousId}' to profile_id '${TEST_PROFILE_ID}'`);
}

testMagicLink().catch(console.error);
