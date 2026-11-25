export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { MODOS } from '@/lib/tienda';
import { dolarOficialVenta } from '@/lib/dolar';
import { cargarCatalogo, loadSenaPct } from '@/lib/tiendaCheckout';

// Precios de la tienda: SOLO para el admin (venta por consulta, 2026-11-25: los precios se charlan, nadie más los
// ve). Nunca cachear en la CDN.
export async function GET(request) {
  const auth = await requireAdmin(request).catch(() => ({ response: Response.json({ error: 'No autorizado' }, { status: 403 }) }));
  if (auth.response) return auth.response;
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
