/**
 * Cleanup script — deletes all test seed rooms (those assigned to the
 * test housekeeper ID yJ6butIw10C4eKu7mJW6) from Firestore.
 *
 * Run: node scripts/cleanup-test-rooms.js
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = admin.firestore();
const TEST_HK_ID = 'yJ6butIw10C4eKu7mJW6';

async function main() {
  console.log(`Searching for all rooms assigned to test housekeeper: ${TEST_HK_ID}`);

  const roomsQuery = await db
    .collectionGroup('rooms')
    .where('assignedTo', '==', TEST_HK_ID)
    .get();

  if (roomsQuery.empty) {
    console.log('No test rooms found — nothing to delete.');
    process.exit(0);
  }

  console.log(`Found ${roomsQuery.size} test room(s) to delete:`);
  roomsQuery.docs.forEach(d => {
    const data = d.data();
    console.log(`  Room ${data.number} — ${data.type} / ${data.date} — ${d.ref.path}`);
  });

  const batch = db.batch();
  roomsQuery.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();

  console.log(`\n✓ Deleted ${roomsQuery.size} test rooms successfully.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
