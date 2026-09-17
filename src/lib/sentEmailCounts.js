// Agrega la colección `sent_emails` en un mapa por email — cuántas veces se le
// escribió a cada negocio y cuándo fue la última vez. Usado por
// /api/auditorias/email-counts (vista por reporte) y /api/auditorias/unificado
// (vista consolidada), para no duplicar la agregación en cada endpoint.
export async function getSentEmailCounts(db) {
  const snap = await db.collection('sent_emails').get();
  const map = {};
  snap.forEach(doc => {
    const d = doc.data();
    const email = (d.email || '').toLowerCase().trim();
    if (!email) return;
    const sentAt = d.createdAt?.toDate?.() || null;
    if (!map[email]) map[email] = { count: 0, lastSentAt: null };
    map[email].count += 1;
    if (sentAt && (!map[email].lastSentAt || sentAt > map[email].lastSentAt)) {
      map[email].lastSentAt = sentAt;
    }
  });
  for (const key of Object.keys(map)) {
    map[key].lastSentAt = map[key].lastSentAt ? map[key].lastSentAt.toISOString() : null;
  }
  return map;
}
