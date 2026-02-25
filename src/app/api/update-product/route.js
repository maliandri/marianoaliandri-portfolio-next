export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';
const db = getDb();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Maliandri$#652542026';

export async function POST(request) {
  try {
    const { adminPassword, productId, updates } = await request.json();

    if (adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    await db.collection('products').doc(productId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return Response.json({ success: true, message: 'Producto actualizado exitosamente', productId });
  } catch (error) {
    return Response.json({ error: 'Error actualizando producto', message: error.message }, { status: 500 });
  }
}
