/**
 * Seed test rooms into Firestore for today's date.
 * Simulates a realistic mix of checkouts, stayovers, and vacant rooms
 * for a 74-room hotel at ~65% occupancy.
 *
 * Usage: node scripts/seed-rooms.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'scraper', '.env') });
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const USER_ID = process.env.HOTELOPS_USER_ID || 'yuUXoy6E8QSeEL6d51y8oXsHCKE3';
const PROPERTY_ID = process.env.HOTELOPS_PROPERTY_ID || 'CGnX9DYc4t0COdzn5ekA';

// Init Firebase Admin
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID || 'hotelops-ai',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();

// Today in YYYY-MM-DD (Central time)
function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
}

async function seed() {
  const today = todayStr();
  console.log(`Seeding rooms for ${today}...`);

  // 74 rooms across 4 floors: 101-118, 201-218, 301-318, 401-420
  const roomNumbers = [];
  for (let f = 1; f <= 4; f++) {
    const count = f === 4 ? 20 : 18;
    for (let r = 1; r <= count; r++) {
      roomNumbers.push(`${f}${String(r).padStart(2, '0')}`);
    }
  }

  // ~65% occupancy = ~48 occupied rooms
  // Split: ~18 checkouts, ~30 stayovers, rest vacant
  const shuffled = [...roomNumbers].sort(() => Math.random() - 0.5);
  const checkouts = shuffled.slice(0, 18);
  const stayovers = shuffled.slice(18, 48);
  // remaining 26 are vacant

  const batch = db.batch();
  let count = 0;

  for (const num of roomNumbers) {
    let type = 'vacant';
    if (checkouts.includes(num)) type = 'checkout';
    else if (stayovers.includes(num)) type = 'stayover';

    const docId = `${today}_${num}`;
    const ref = db
      .collection('users').doc(USER_ID)
      .collection('properties').doc(PROPERTY_ID)
      .collection('rooms').doc(docId);

    batch.set(ref, {
      number: num,
      type,
      status: 'dirty',
      priority: 'standard',
      date: today,
      propertyId: PROPERTY_ID,
      isDnd: false,
      assignedTo: null,
      assignedName: null,
      _caRoomType: type === 'vacant' ? 'None' : type === 'checkout' ? 'Check Out' : 'Stay Over',
      _caCondition: 'Dirty',
      _lastSyncedAt: Timestamp.now(),
    });
    count++;
  }

  await batch.commit();
  console.log(`Done! Seeded ${count} rooms (18 checkouts, 30 stayovers, 26 vacant) for ${today}`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Error seeding rooms:', err);
  process.exit(1);
});
