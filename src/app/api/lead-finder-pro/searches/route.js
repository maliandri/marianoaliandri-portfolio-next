export const dynamic = 'force-dynamic';

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Historial de búsquedas por cliente — para volver a ver una búsqueda anterior
// (config + resultados) sin tener que relanzarla contra Google Places.
const COL = 'leadfinder_searches';
const MAX_RESULTS_STORED = 300; // cap defensivo de tamaño del doc

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  const id = new URL(request.url).searchParams.get('id');
  const col = db.collection(COL).doc(user.uid).collection('items');

  if (id) {
    const snap = await col.doc(id).get();
    if (!snap.exists) return Response.json({ error: 'No encontrada' }, { status: 404 });
    const data = snap.data();
    return Response.json({ id: snap.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null });
  }

  const snap = await col.orderBy('createdAt', 'desc').limit(20).get();
  const items = snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ciudades: data.ciudades, tipos: data.tipos, terminos: data.terminos, radioKm: data.radioKm,
      resultCount: data.results?.length || 0,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
    };
  });
  return Response.json({ items });
}

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  const { ciudades, tipos, terminos, radioKm, results } = body;
  if (!Array.isArray(results) || !results.length) return Response.json({ error: 'results vacío' }, { status: 400 });

  const ref = await db.collection(COL).doc(user.uid).collection('items').add({
    ciudades: ciudades || [], tipos: tipos || [], terminos: terminos || [], radioKm: radioKm || null,
    results: results.slice(0, MAX_RESULTS_STORED),
    createdAt: FieldValue.serverTimestamp(),
  });

  return Response.json({ success: true, id: ref.id });
}

export async function DELETE(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });

  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  await db.collection(COL).doc(user.uid).collection('items').doc(id).delete();
  return Response.json({ success: true });
}
