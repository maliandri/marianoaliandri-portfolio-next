export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { aceptarMeet, rechazarMeet, getCalendarAuth } from '@/lib/googleCalendar';
import { alertError } from '@/lib/alert';

// Admin: aceptar o rechazar el Meet que pidió un cliente desde la tienda.
// POST { id, accion: 'aceptar' | 'rechazar' } → { ok, meetUrl? } | { error }
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const { id, accion } = await request.json().catch(() => ({}));
    if (!id || !['aceptar', 'rechazar'].includes(accion)) return Response.json({ error: 'Pedido inválido' }, { status: 400 });
    const db = getDb();
    if (accion === 'rechazar') {
      const r = await rechazarMeet(db, id);
      return Response.json(r.error ? { error: r.error } : { ok: true }, { status: r.status });
    }
    const cal = await getCalendarAuth(db);
    const r = await aceptarMeet(db, id, { accessToken: cal?.accessToken });
    return Response.json(r.error ? { error: r.error } : { ok: true, meetUrl: r.meetUrl }, { status: r.status });
  } catch (e) {
    await alertError('gcal:aceptar', 'No se pudo crear el Meet', e);
    return Response.json({ error: 'No se pudo crear la reunión. Probá de nuevo.' }, { status: 500 });
  }
}
