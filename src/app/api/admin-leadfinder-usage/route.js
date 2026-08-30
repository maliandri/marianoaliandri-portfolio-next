export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Caps actuales configurados a mano en Google Cloud Console (Places API > Cuotas).
// Si los cambiás ahí, actualizá también acá para que las barras reflejen el techo real.
const CAPS = {
  getPlaceRequests: 100,
  searchNearbyRequests: 500,
  searchTextRequests: 500,
};

function dateKey(d) { return d.toISOString().slice(0, 10); }

export async function GET(request) {
  try {
    const adminPassword = new URL(request.url).searchParams.get('adminPassword');
    if (adminPassword !== ADMIN_PASSWORD || !ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }

    const db = getDb();
    if (!db) return Response.json({ today: null, days: [], caps: CAPS });

    // Últimos 7 días (incluye hoy)
    const keys = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      return dateKey(d);
    });

    const snaps = await Promise.all(keys.map(k => db.collection('leadfinder_usage').doc(k).get()));
    const days = snaps.map((snap, i) => {
      const data = snap.exists ? snap.data() : {};
      return {
        date: keys[i],
        getPlaceRequests: data.getPlaceRequests || 0,
        searchNearbyRequests: data.searchNearbyRequests || 0,
        searchTextRequests: data.searchTextRequests || 0,
        cacheHits: data.cacheHits || 0,
      };
    }).reverse(); // más viejo primero

    return Response.json({ today: days[days.length - 1], days, caps: CAPS });
  } catch (error) {
    return Response.json({ error: 'Error leyendo uso', details: error.message }, { status: 500 });
  }
}
