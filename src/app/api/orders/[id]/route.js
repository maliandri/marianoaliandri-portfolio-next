export const dynamic = 'force-dynamic';
import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';

// GET /api/orders/[id]/ -- detalle de un pedido para /mis-compras/[orderId]. A diferencia
// de las mutaciones de admin (adminPassword compartida), esto lo llama el cliente logueado
// para ver SU PROPIO pedido, así que usa el idToken de Firebase + chequeo de ownership
// (mismo criterio por userId/customerEmail que ya usa OrdersPage.jsx para el listado).
export async function GET(request, { params }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return Response.json({ error: 'Necesitás iniciar sesión' }, { status: 401 });

    const { id } = await params;
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const snap = await db.collection('orders').doc(id).get();
    if (!snap.exists) return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
    const order = snap.data();

    const isOwner = order.userId === user.uid
      || (order.customerEmail && user.email && order.customerEmail.toLowerCase() === user.email.toLowerCase());
    if (!isOwner) return Response.json({ error: 'No autorizado' }, { status: 403 });

    return Response.json({
      id: snap.id,
      type: order.type,
      status: order.status,
      stage: order.stage || 'pago_confirmado',
      stageHistory: (order.stageHistory || []).map(h => ({
        stage: h.stage,
        note: h.note || '',
        at: h.at?.toDate?.()?.toISOString() || null,
      })),
      items: order.items || [],
      totalARS: order.totalARS || 0,
      createdAt: order.createdAt?.toDate?.()?.toISOString() || null,
    });
  } catch (error) {
    console.error('[orders/[id]] ERROR:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
