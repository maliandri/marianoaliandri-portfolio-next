import { FieldValue } from 'firebase-admin/firestore';
import { envInt } from './config';

// Tope diario de publicaciones en redes hechas desde el MCP (posts + historias), aparte de los
// límites de Instagram: MCP_SOCIAL_DAILY_CAP (default 10). Contador en mcp_social_counter/{día UTC}.
export async function claimSocialSlot(db, now = new Date()) {
  const cap = envInt('MCP_SOCIAL_DAILY_CAP', 10);
  const ref = db.collection('mcp_social_counter').doc(now.toISOString().slice(0, 10));
  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const n = snap.exists ? snap.data().n || 0 : 0;
    if (n >= cap) return { ok: false, cap };
    tx.set(ref, { n: n + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true, cap, usadas: n + 1 };
  });
}
