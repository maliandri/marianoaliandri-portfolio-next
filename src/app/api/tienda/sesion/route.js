export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { registrarSesion, textoAviso } from '@/lib/tiendaSesion';
import { sendTelegram } from '@/lib/telegram';
import { cargarCatalogo } from '@/lib/tiendaCheckout';
import { linkAdminChat } from '@/lib/chatVivo';

const ipDe = (request) => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip';
const SITE = 'https://marianoaliandri.com.ar';

// La tienda reporta lo que va marcando la visita (agrupado cada ~3 s) para avisarle a Mariano por Telegram cuando
// alguien arma en serio. POST { id, servicios: [ids], ultimaPregunta } → { ok }. No se guarda la IP (solo se usa
// para el tope de pedidos).
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const db = getDb();
    const rl = await hitRateLimit(db, `tienda-sesion:ip_${ipDe(request)}`, { limit: 120, windowS: 3600 });
    if (!rl.ok) return Response.json({ ok: false }, { status: 429 });

    let ciudad = '';
    try { ciudad = decodeURIComponent(request.headers.get('x-vercel-ip-city') || ''); } catch { /* header raro */ }

    await registrarSesion(db, {
      id: body?.id,
      servicios: Array.isArray(body?.servicios) ? body.servicios : [],
      ultimaPregunta: body?.ultimaPregunta || '',
      ciudad,
      ua: request.headers.get('user-agent') || '',
    }, {
      avisar: async (s) => {
        const labels = Object.fromEntries((await cargarCatalogo(db)).map(i => [i.id, i.label]));
        // "Entrar al chat" abre /admin/chat/tienda_<id>/: la charla de esta visita con el asistente, en vivo.
        await sendTelegram({ texto: textoAviso(s, { labels }), botones: [
          { texto: '💬 Entrar al chat', url: linkAdminChat(`tienda_${body?.id}`) },
          { texto: 'Ver en el admin', url: `${SITE}/admin/` },
        ] });
      },
    });
    return Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[tienda/sesion]', e?.message);
    return Response.json({ ok: false }, { status: 500 });
  }
}
