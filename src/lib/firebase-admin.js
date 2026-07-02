import admin from 'firebase-admin';

function initAdmin() {
  if (admin.apps.length) return;
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (e) {
    // Logged so Vercel surfaces the real error instead of silent 404s
    console.error('[firebase-admin] init failed:', e.message);
  }
}

// Attempt at module load (may fail during build when env vars aren't available)
initAdmin();

export function getDb() {
  // Re-attempt if module-level init failed (e.g. during build time cold start)
  if (!admin.apps.length) initAdmin();
  if (!admin.apps.length) return null;
  return admin.firestore();
}

export default admin;
