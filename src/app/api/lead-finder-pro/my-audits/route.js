export const dynamic = 'force-dynamic';

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';

// Consulta en bloque cuáles de estos placeId ya fueron auditados antes por ESTE cliente
// (cualquier búsqueda anterior) — así el buscador los muestra directo, sin relanzar
// la auditoría ni gastar otro crédito.
export async function POST(request) {
  const authUser = await getUserFromRequest(request);
  if (!authUser) return Response.json({ error: 'No autenticado' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const placeIds = Array.isArray(body.placeIds) ? body.placeIds.slice(0, 200) : [];
  if (!placeIds.length) return Response.json({ audits: {} });

  const db = getDb();
  if (!db) return Response.json({ audits: {} });

  const col = db.collection('leadfinder_client_audits').doc(authUser.uid).collection('audits');
  const snaps = await db.getAll(...placeIds.map(id => col.doc(id)));

  const audits = {};
  snaps.forEach(snap => {
    if (snap.exists) {
      const { auditedAt: _o, ...rest } = snap.data();
      audits[snap.id] = rest;
    }
  });

  return Response.json({ audits });
}
