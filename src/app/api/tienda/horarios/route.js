export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { turnosPublicos } from '@/lib/meetServer';

// Turnos libres para el Meet de la venta por consulta. Público: devuelve solo inicios (ISO) sin ningún dato del
// calendario. Cacheado 60 s en la CDN (la disponibilidad se re-chequea al pedir y al aceptar).
export async function GET() {
  try {
    const r = await turnosPublicos(getDb());
    return Response.json(r, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } });
  } catch (e) {
    console.error('[tienda/horarios]', e.message);
    return Response.json({ disponible: false, turnos: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
