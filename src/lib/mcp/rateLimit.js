import { FieldValue } from 'firebase-admin/firestore';

// Rate limiting de ventana fija en Firestore (un doc por clave y ventana, en transacción).
// Sirve igual en serverless: no depende de la memoria de una instancia.
const COL = 'mcp_rate';

export async function hitRateLimit(db, key, { limit, windowS, now = Date.now() }) {
  const windowMs = windowS * 1000;
  const start = Math.floor(now / windowMs) * windowMs;
  const safeKey = String(key).replace(/[^\w.-]/g, '_').slice(0, 100);
  const ref = db.collection(COL).doc(`${safeKey}__${windowS}__${start}`);
  const ok = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const n = snap.exists ? snap.data().n || 0 : 0;
    if (n >= limit) return false;
    tx.set(ref, { n: n + 1, expiresAt: start + windowMs, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
  return { ok, retryAfterS: ok ? 0 : Math.ceil((start + windowMs - now) / 1000) };
}
