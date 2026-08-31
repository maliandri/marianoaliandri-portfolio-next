export const dynamic = 'force-dynamic';

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Historial de búsquedas de Rubros buscados por cliente — para volver a ver una
// búsqueda anterior sin gastar otra vez la cuota de su plan.
const COL = 'keyword_searches';

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
      provincia: data.provincia, localidad: data.localidad, cats: data.cats,
      rubroCount: data.results?.length || 0,
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
  const { provincia, localidad, cats, results } = body;
  if (!localidad || !Array.isArray(results)) return Response.json({ error: 'localidad y results son requeridos' }, { status: 400 });

  const ref = await db.collection(COL).doc(user.uid).collection('items').add({
    provincia: provincia || '', localidad, cats: cats || [], results,
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
