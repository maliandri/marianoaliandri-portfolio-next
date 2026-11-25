export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { crearSolicitud } from '@/lib/tiendaSolicitud';
import { validarTurnoServidor } from '@/lib/meetServer';
import { avisarSolicitud } from '@/lib/tiendaSesion';
import { alertError } from '@/lib/alert';

const SITE = process.env.NEXT_PUBLIC_BASE_URL || 'https://marianoaliandri.com.ar';

// Solicitud de presupuesto de la tienda (venta por consulta, 2026-11-25). Ya NO cobra: guarda lo marcado + datos
// + Meet opcional en `presupuestos`, avisa a Mariano por Telegram y por mail, y le confirma al cliente por mail.
// POST { servicios: [ids], cliente, chat, meet: { inicio } | null, sesionId, website (trampa para bots) }
// Exige sesión de Google (Authorization: Bearer <idToken>): sin ella responde 401.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.website) return Response.json({ ok: true }); // honeypot: los bots lo completan
    const user = await getUserFromRequest(request).catch(() => null);
    const db = getDb();
    const r = await crearSolicitud(db, body, {
      user,
      turnoValido: (inicio) => validarTurnoServidor(db, inicio),
      avisar: (id) => avisarSolicitud(db, id),
    });
    if (r.error) return Response.json({ error: r.error }, { status: r.status });

    // Aviso a Mariano + confirmación al cliente (mismos mails que el formulario de presupuesto, sin montos).
    const payload = {
      name: body.cliente?.nombre, email: body.cliente?.email, phone: body.cliente?.telefono, company: body.cliente?.empresa,
      message: [body.cliente?.notas, body.meet?.inicio ? `Pidió Meet: ${body.meet.inicio}` : 'Sin Meet'].filter(Boolean).join('\n\n'),
      services: Array.isArray(body.servicios) ? body.servicios : [],
      deadline: '', budgetId: r.id,
    };
    await Promise.allSettled(['budget-received', 'budget-confirmation'].map(type => fetch(`${SITE}/api/send-email/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, ...payload }),
    })));

    return Response.json({ ok: true, id: r.id }, { status: 201 });
  } catch (e) {
    console.error('[tienda POST]', e);
    await alertError('tienda:solicitud', 'Tienda: no se pudo guardar una solicitud de presupuesto', e);
    return Response.json({ error: 'No se pudo enviar el pedido. Probá de nuevo o escribime por WhatsApp.' }, { status: 500 });
  }
}
