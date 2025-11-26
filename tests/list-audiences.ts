import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .dev.vars
const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
if (fs.existsSync(devVarsPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(devVarsPath));
  process.env.RESEND_API_KEY = envConfig.RESEND_API_KEY;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;

async function listAudiences() {
  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY');
    return;
  }

  console.log('Fetching audiences...');
  const res = await fetch('https://api.resend.com/audiences', {
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`
    }
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Audiences:', JSON.stringify(data, null, 2));
}

listAudiences().catch(console.error);
