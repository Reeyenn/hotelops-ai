/**
 * Cleanup test rooms via Firestore REST API (no gRPC, proxy-friendly).
 * Uses google-auth-library to get a service account token, then deletes
 * all rooms assigned to the test housekeeper ID.
 *
 * Run: node scripts/cleanup-test-rooms-rest.js
 */

require('dotenv').config({ path: '.env.local' });
const { GoogleAuth } = require('google-auth-library');
const https = require('https');

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const TEST_HK_ID = 'yJ6butIw10C4eKu7mJW6';

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });

    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. Get access token via service account
  const auth = new GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ['https://www.googleapis.com/auth/datastore'],
  });
  const token = await auth.getAccessToken();
  console.log('✓ Got service account token');

  const base = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2. Query all rooms with assignedTo == TEST_HK_ID
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'rooms', allDescendants: true }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'assignedTo' },
          op: 'EQUAL',
          value: { stringValue: TEST_HK_ID },
        },
      },
    },
  };

  console.log('Querying test rooms...');
  const queryRes = await httpsRequest(`${base}:runQuery`, { method: 'POST', headers }, queryBody);

  const roomDocs = (queryRes.body || []).filter(r => r.document);
  if (roomDocs.length === 0) {
    console.log('No test rooms found — nothing to delete.');
    return;
  }

  console.log(`Found ${roomDocs.length} test room(s):`);
  roomDocs.forEach(r => {
    const f = r.document.fields;
    console.log(`  Room ${f.number?.stringValue} — ${f.type?.stringValue} / ${f.date?.stringValue}`);
  });

  // 3. Batch delete
  const writes = roomDocs.map(r => ({ delete: r.document.name }));
  const batchRes = await httpsRequest(
    `${base}:batchWrite`,
    { method: 'POST', headers },
    { writes }
  );

  if (batchRes.status === 200) {
    console.log(`\n✓ Successfully deleted ${roomDocs.length} test rooms.`);
  } else {
    console.error('Batch delete failed:', JSON.stringify(batchRes.body));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
