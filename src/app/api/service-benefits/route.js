export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/adminAuth';

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
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const { id, benefit, priceUSD } = await request.json();
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });
    // Cada campo se guarda solo si viene: guardar el precio no borra el texto, y viceversa.
    // priceUSD es el precio que cobra la tienda (/tienda); null vuelve al del código.
    const update = { updatedAt: FieldValue.serverTimestamp() };
    if (benefit !== undefined) update.benefit = benefit || '';
    if (priceUSD !== undefined) {
      if (priceUSD !== null && !(Number(priceUSD) > 0 && Number(priceUSD) < 100000)) {
        return Response.json({ error: 'Precio inválido' }, { status: 400 });
      }
      update.priceUSD = priceUSD === null ? FieldValue.delete() : Number(priceUSD);
    }
    await db.collection('service_benefits').doc(id).set(update, { merge: true });
    return Response.json({ success: true });
  } catch (e) {
    console.error('[service-benefits PATCH]', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
