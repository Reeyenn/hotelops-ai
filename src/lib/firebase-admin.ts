import admin from 'firebase-admin';

// Prevent duplicate initialization in Next.js hot reload
if (!admin.apps.length) {
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const projectId   = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!clientEmail || !privateKey || !projectId) {
    throw new Error(
      'Firebase Admin SDK not configured. ' +
      'Add FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY to .env.local'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({ clientEmail, privateKey, projectId }),
  });
}

export default admin;
