const WORKER_URL = 'http://localhost:8787/events/ingest';

async function testConsent() {
  console.log('🧪 Starting Consent Tests...\n');

  // ---------------------------------------------------------
  // TEST 1: Consent GRANTED
  // Should receive Set-Cookie and consistent ID
  // ---------------------------------------------------------
  console.log('Test 1: Consent GRANTED');
  
  const res1 = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tracking-Consent': 'granted',
      'Origin': 'https://lucascosta.tech'
    },
    body: JSON.stringify({
      name: 'page_view',
      timestamp: new Date().toISOString(),
      context: { page: { url: 'https://example.com' } },
      properties: {}
    })
  });

  const data1 = await res1.json() as { anonymousId: string };
  const cookie1 = res1.headers.get('set-cookie');

  console.log('  Response 1:', res1.status);
  console.log('  Cookie:', cookie1 ? '✅ Present' : '❌ Missing');
  console.log('  Anon ID:', data1.anonymousId);

  if (!cookie1) throw new Error('Should set cookie when consent is granted');
  if (!cookie1.includes('lc_anon_id')) throw new Error('Cookie should be lc_anon_id');

  // Request 2 with cookie
  const res2 = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tracking-Consent': 'granted',
      'Cookie': cookie1,
      'Origin': 'https://lucascosta.tech'
    },
    body: JSON.stringify({
      name: 'page_view',
      timestamp: new Date().toISOString(),
      context: { page: { url: 'https://example.com' } },
      properties: {}
    })
  });

  const data2 = await res2.json() as { anonymousId: string };
  console.log('  Anon ID 2:', data2.anonymousId);

  if (data1.anonymousId !== data2.anonymousId) throw new Error('Should persist ID when consent granted');
  console.log('✅ PASSED: Consent Granted maintains identity\n');


  // ---------------------------------------------------------
  // TEST 2: Consent DENIED
  // Should NOT set cookie and should rotate IDs
  // ---------------------------------------------------------
  console.log('Test 2: Consent DENIED');

  const res3 = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tracking-Consent': 'denied',
      'Origin': 'https://lucascosta.tech'
    },
    body: JSON.stringify({
      name: 'page_view',
      timestamp: new Date().toISOString(),
      context: { page: { url: 'https://example.com' } },
      properties: {}
    })
  });

  const data3 = await res3.json() as { anonymousId: string };
  const cookie3 = res3.headers.get('set-cookie');

  console.log('  Response 3:', res3.status);
  console.log('  Cookie:', cookie3 ? '❌ Present' : '✅ Missing');
  console.log('  Anon ID 3:', data3.anonymousId);

  if (cookie3) throw new Error('Should NOT set cookie when consent denied');

  // Request 4 (New request, no cookie sent because none was set)
  const res4 = await fetch(WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tracking-Consent': 'denied',
      'Origin': 'https://lucascosta.tech'
    },
    body: JSON.stringify({
      name: 'page_view',
      timestamp: new Date().toISOString(),
      context: { page: { url: 'https://example.com' } },
      properties: {}
    })
  });

  const data4 = await res4.json() as { anonymousId: string };
  console.log('  Anon ID 4:', data4.anonymousId);

  if (data3.anonymousId === data4.anonymousId) throw new Error('Should generate NEW ID every time when consent denied');
  console.log('✅ PASSED: Consent Denied prevents tracking\n');

  console.log('🎉 All Consent Tests Passed!');
}

testConsent().catch(console.error);
