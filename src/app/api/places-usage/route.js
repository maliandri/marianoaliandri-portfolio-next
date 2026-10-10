export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Devuelve los contadores diarios de leadfinder_usage de un mes (YYYY-MM).
export async function POST(request) {
  try {
    const { adminPassword, month } = await request.json();
    if (!ADMIN_PASSWORD || adminPassword !== ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!/^\d{4}-\d{2}$/.test(month || '')) {
      return Response.json({ error: 'month inválido (YYYY-MM)' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const snap = await db.collection('leadfinder_usage')
      .where('__name__', '>=', `${month}-01`)
      .where('__name__', '<=', `${month}-31`)
      .get();

    const rows = snap.docs.map(d => {
      const { getPlaceRequests = 0, searchTextRequests = 0, searchNearbyRequests = 0 } = d.data();
      return { id: d.id, getPlaceRequests, searchTextRequests, searchNearbyRequests };
    });

    return Response.json({ rows });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
