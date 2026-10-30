export const dynamic = 'force-dynamic';
export const maxDuration = 300; // la IA puede tardar (Gemini saturado → respaldo) + render de placas + LinkedIn

import { requireAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/firebase-admin';
import { runContenido, publicarContenido, CONTENIDOS } from '@/lib/contenidoRun';
import { dispararReel, textoReel } from '@/lib/reelDispatch';

// Cron de Vercel (vercel.json, lun–vie 15:00 UTC = 12:00 ART): "Authorization: Bearer <CRON_SECRET>".
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await runContenido()) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Admin. { id } = publicar un borrador ya generado. { pedirReel: id } = armar el reel de una pieza.
// Si no: generar una pieza (ignora el interruptor), con { tema } (la idea puntual) y { conReel } opcionales,
// con { serieId } opcional y { publicar } (default false = vista previa).
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.id === 'string') return Response.json({ ok: true, ...(await publicarContenido(getDb(), body.id)) });
    if (typeof body?.pedirReel === 'string') {
      const ref = getDb().collection(CONTENIDOS).doc(body.pedirReel);
      if (!(await ref.get()).exists) return Response.json({ error: 'No existe esa pieza' }, { status: 404 });
      await ref.update({ reelPedido: true });
      return Response.json({ ok: true, reel: textoReel(await dispararReel(body.pedirReel)) });
    }
    const result = await runContenido({
      force: true,
      serieId: typeof body?.serieId === 'string' && body.serieId ? body.serieId : null,
      tema: typeof body?.tema === 'string' ? body.tema.trim().slice(0, 500) : '',
      conReel: body?.conReel === true,
      publicar: body?.publicar === true,
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
