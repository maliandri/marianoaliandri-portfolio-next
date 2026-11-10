export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { MODOS } from '@/lib/tienda';
import { checkoutTienda } from '@/lib/tiendaCheckout';
import { alertError } from '@/lib/alert';

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://marianoaliandri.com.ar';

// Catálogo y precios: el catálogo sin precios sale en la página (/tienda); los precios, solo con sesión, en
// /api/tienda/precios/.
// POST { servicios: [ids], cantidades: { id: n }, modo: 'sena' | 'total' | 'presupuesto', cliente, website (trampa para bots) }
// Exige sesión de Google (Authorization: Bearer <idToken>): sin ella responde 401.
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
