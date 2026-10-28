export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { catalogoEfectivo, MODOS } from '@/lib/tienda';
import { dolarOficialVenta } from '@/lib/dolar';
import { checkoutTienda, loadOverrides } from '@/lib/tiendaCheckout';
import { alertError } from '@/lib/alert';

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://marianoaliandri.com.ar';

// GET: catálogo con precios efectivos + cotización del dólar (público, cacheado 1 min en la CDN: el precio
// que se cobra se recalcula en el POST, esto es solo lo que se muestra).
export async function GET() {
  try {
    const [overrides, dolar] = await Promise.all([
      loadOverrides(getDb()),
      dolarOficialVenta().catch(() => null),
    ]);
    return Response.json(
      { catalogo: catalogoEfectivo(overrides), cotizacion: dolar?.cotizacion ?? null, modos: MODOS },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=600' } },
    );
  } catch (e) {
    console.error('[tienda GET]', e);
    return Response.json({ error: 'No se pudo cargar el catálogo' }, { status: 500 });
  }
}

// POST { servicios: [ids], modo: 'sena' | 'total' | 'presupuesto', cliente, website (trampa para bots) }
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.website) return Response.json({ ok: true }); // honeypot: los bots lo completan
    const user = await getUserFromRequest(request).catch(() => null);
    const r = await checkoutTienda(getDb(), body, { user });
    if (r.error) return Response.json({ error: r.error }, { status: r.status });

    // Aviso a Mariano + confirmación al cliente (mismo mail que el formulario de presupuesto).
    const q = r.cotizacionResumen;
    const payload = {
      name: body.cliente.nombre, email: body.cliente.email, phone: body.cliente.telefono, company: body.cliente.empresa,
      message: [body.cliente.notas, `Tienda · ${MODOS[q.modo].label} · Total USD ${q.totalUSD}${q.aPagarARS ? ` · a pagar ARS ${q.aPagarARS.toLocaleString('es-AR')}` : ''}`].filter(Boolean).join('\n\n'),
      services: q.items.map(i => `${i.label} (USD ${i.priceUSD})`),
      deadline: '', budgetId: r.id,
    };
    await Promise.allSettled(['budget-received', 'budget-confirmation'].map(type => fetch(`${SITE}/api/send-email/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...payload }),
    })));

    return Response.json({ ok: true, id: r.id, init_point: r.init_point || null });
  } catch (e) {
    console.error('[tienda POST]', e);
    await alertError('tienda:checkout', 'Tienda: no se pudo crear el pedido o el link de pago', e);
    return Response.json({ error: 'No se pudo procesar el pedido. Probá de nuevo o escribime por WhatsApp.' }, { status: 500 });
  }
}
