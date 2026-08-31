import { getDb } from '@/lib/firebase-admin';

export async function GET(request, { params }) {
  try {
    const { productId } = await params;
    const db = getDb();
    if (!db) return Response.json(null);

    const snap = await db.collection('productos_alquiler').doc(productId).get();
    if (!snap.exists) return Response.json(null);

    const data = snap.data();
    if (!data.activo) return Response.json(null);

    return Response.json(data);
  } catch (error) {
    return Response.json(null);
  }
}
