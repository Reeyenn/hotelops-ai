require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: 'scraper/.env', override: false });
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
if (!getApps().length) {
  initializeApp({ credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY||'').replace(/\\n/g,'\n'),
  })});
}
const db = getFirestore();
db.collection('users').doc(process.env.HOTELOPS_USER_ID)
  .collection('properties').doc(process.env.HOTELOPS_PROPERTY_ID)
  .collection('staff').add({
    name: 'Reeyen', phone: '+14098282023',
    isActive: true, role: 'housekeeper',
    daysWorkedThisWeek: 0, maxDaysPerWeek: 5,
  }).then(r => { console.log('Done — staff ID:', r.id); process.exit(0); })
  .catch(e => { console.error(e.message); process.exit(1); });
