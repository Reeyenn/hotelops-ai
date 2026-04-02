/**
 * set-test-phones.js
 *
 * Sets every staff member's phone to Reeyen's number for testing.
 * Run once from the hotelops-ai root:
 *   node scripts/set-test-phones.js
 *
 * Remove / update individual numbers when real HK phones are ready.
 */

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: 'scraper/.env', override: false }); // fallback for admin creds
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

const UID = process.env.HOTELOPS_USER_ID;
const PID = process.env.HOTELOPS_PROPERTY_ID;
const TEST_PHONE = '+14098282023'; // Reeyen's number — replace with real HK numbers later

async function main() {
  const staffSnap = await db
    .collection('users').doc(UID)
    .collection('properties').doc(PID)
    .collection('staff')
    .get();

  if (staffSnap.empty) {
    console.log('No staff documents found. Check UID/PID in .env.local');
    return;
  }

  console.log(`Found ${staffSnap.size} staff members. Setting all phones to ${TEST_PHONE}...\n`);

  const batch = db.batch();
  staffSnap.docs.forEach(doc => {
    const name = doc.data().name ?? doc.id;
    console.log(`  ${name} (${doc.id})`);
    batch.update(doc.ref, { phone: TEST_PHONE });
  });

  await batch.commit();
  console.log(`\nDone — all ${staffSnap.size} staff updated.`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
