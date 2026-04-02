/**
 * Seed test rooms for housekeeper mobile view testing.
 *
 * Finds the staff document yJ6butIw10C4eKu7mJW6 via collectionGroup,
 * sets scheduledToday=true on it, then creates 5-6 rooms assigned to
 * that housekeeper so the mobile view shows actual rooms.
 *
 * Run: node scripts/seed-test-rooms.js
 */

require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// ── Init Admin SDK ──────────────────────────────────────────────────────────
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = admin.firestore();

const HOUSEKEEPER_ID = 'yJ6butIw10C4eKu7mJW6';
// Use local date (same as the app's todayStr which uses date-fns format(new Date(), 'yyyy-MM-dd'))
const _now = new Date();
const TODAY = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

const TEST_ROOMS = [
  { number: '101', type: 'checkout',  priority: 'standard', status: 'dirty' },
  { number: '102', type: 'checkout',  priority: 'vip',      status: 'dirty' },
  { number: '105', type: 'stayover',  priority: 'standard', status: 'dirty' },
  { number: '201', type: 'checkout',  priority: 'early',    status: 'dirty' },
  { number: '203', type: 'stayover',  priority: 'standard', status: 'dirty' },
  { number: '208', type: 'stayover',  priority: 'standard', status: 'dirty' },
];

async function main() {
  // ── 1. Find the staff document by collectionGroup scan ────────────────────
  // Firestore collectionGroup doesn't support documentId() filter with bare IDs,
  // so we fetch all staff docs and find the matching one in-code.
  console.log(`Looking up staff doc: ${HOUSEKEEPER_ID}`);
  const staffQuery = await db.collectionGroup('staff').get();

  const staffDoc = staffQuery.docs.find(d => d.id === HOUSEKEEPER_ID);

  if (!staffDoc) {
    console.error('Staff document not found. Check the ID and try again.');
    process.exit(1);
  }
  const staffPath = staffDoc.ref.path; // users/{uid}/properties/{pid}/staff/{staffId}
  console.log(`Found staff doc at: ${staffPath}`);

  // Extract uid and propertyId from the path
  const pathParts = staffPath.split('/');
  // ['users', uid, 'properties', pid, 'staff', staffId]
  const uid = pathParts[1];
  const propertyId = pathParts[3];
  console.log(`uid=${uid}  propertyId=${propertyId}`);

  // ── 2. Set scheduledToday=true on the staff doc ───────────────────────────
  await staffDoc.ref.update({ scheduledToday: true });
  console.log('✓ scheduledToday=true set on staff doc');

  // ── 3. Create test rooms assigned to this housekeeper ────────────────────
  const roomsRef = db
    .collection('users')
    .doc(uid)
    .collection('properties')
    .doc(propertyId)
    .collection('rooms');

  // First: delete any existing test rooms for today assigned to this housekeeper
  const existing = await roomsRef
    .where('assignedTo', '==', HOUSEKEEPER_ID)
    .where('date', '==', TODAY)
    .get();

  if (!existing.empty) {
    const batch = db.batch();
    existing.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Deleted ${existing.size} existing rooms for today`);
  }

  // Create new rooms
  const batch = db.batch();
  const staffData = staffDoc.data();

  for (const room of TEST_ROOMS) {
    const ref = roomsRef.doc(); // auto-ID
    batch.set(ref, {
      ...room,
      assignedTo: HOUSEKEEPER_ID,
      assignedName: staffData?.name ?? 'Reeyen',
      date: TODAY,
      propertyId,
      startedAt: null,
      completedAt: null,
      isDnd: false,
    });
  }

  await batch.commit();
  console.log(`✓ Created ${TEST_ROOMS.length} test rooms for ${TODAY}`);
  console.log('\nRoom summary:');
  TEST_ROOMS.forEach(r =>
    console.log(`  Room ${r.number} — ${r.type} / ${r.priority} / ${r.status}`)
  );

  console.log(`\nTest URL: https://hotelops-ai.vercel.app/housekeeper/${HOUSEKEEPER_ID}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
