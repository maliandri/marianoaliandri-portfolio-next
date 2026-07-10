export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({});
    const snap = await db.collection('service_benefits').get();
    const result = {};
    snap.docs.forEach(d => { result[d.id] = d.data().benefit || ''; });
    return Response.json(result);
  } catch (e) {
    console.error('[service-benefits GET]', e.message);
    return Response.json({});
  }
}

export async function PATCH(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const { id, benefit } = await request.json();
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });
    await db.collection('service_benefits').doc(id).set({
      benefit: benefit || '',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return Response.json({ success: true });
  } catch (e) {
    console.error('[service-benefits PATCH]', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
