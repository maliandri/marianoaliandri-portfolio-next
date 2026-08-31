import { getDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({});

    const snap = await db.collection('productos_alquiler').get();
    const result = {};
    snap.forEach(doc => {
      const data = doc.data();
      if (data.activo) result[doc.id] = data;
    });

    return Response.json(result);
  } catch {
    return Response.json({});
  }
}
