export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
const db = getDb();


export async function POST(request) {
  try {
    const { productId, updates } = await request.json();

    const { response: noAdmin } = await requireAdmin(request);
    if (noAdmin) return noAdmin;

    await db.collection('products').doc(productId).update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return Response.json({ success: true, message: 'Producto actualizado exitosamente', productId });
  } catch (error) {
    return Response.json({ error: 'Error actualizando producto', message: error.message }, { status: 500 });
  }
}
