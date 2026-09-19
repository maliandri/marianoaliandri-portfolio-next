import admin, { getDb } from '@/lib/firebase-admin';

// Verifica el idToken de Firebase que llega en el header Authorization: Bearer <token>.
// Devuelve { uid, email, emailVerified } o null si no hay token válido.
// Reutilizado por las rutas protegidas (keyword-explorer, me, subscribe).
export async function getUserFromRequest(request) {
  try {
    const header = request.headers.get('authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return null;
    const token = match[1].trim();
    if (!token) return null;

    // getDb() reintenta la init del Admin SDK si falló en cold start.
    if (!getDb()) return null;
    const decoded = await admin.auth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || null, emailVerified: decoded.email_verified === true };
  } catch (e) {
    console.error('[authServer] verifyIdToken failed:', e.message);
    return null;
  }
}
