export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { MODOS } from '@/lib/tienda';
import { dolarOficialVenta } from '@/lib/dolar';
import { cargarCatalogo, loadSenaPct } from '@/lib/tiendaCheckout';

// Precios de la tienda: SOLO para quien inició sesión (idToken de Google en Authorization). Sin sesión → 401
// y no sale ningún precio. Nunca cachear en la CDN: la respuesta es por usuario.
export async function GET(request) {
  const user = await getUserFromRequest(request).catch(() => null);
  if (!user) return Response.json({ error: 'Iniciá sesión con Google para ver los precios' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } });
  try {
    const db = getDb();
    const [catalogo, senaPct, dolar] = await Promise.all([
      cargarCatalogo(db),
      loadSenaPct(db),
      dolarOficialVenta().catch(() => null),
    ]);
    return Response.json(
      {
        precios: Object.fromEntries(catalogo.filter(s => s.activo !== false).map(s => [s.id, s.priceUSD])),
        cotizacion: dolar?.cotizacion ?? null,
        senaPct,
        modos: MODOS,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('[tienda/precios GET]', e);
    return Response.json({ error: 'No se pudieron cargar los precios' }, { status: 500 });
  }
}
