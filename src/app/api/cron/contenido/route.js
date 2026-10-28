export const dynamic = 'force-dynamic';
export const maxDuration = 300; // la IA puede tardar (Gemini saturado → respaldo) + render de placas + LinkedIn

import { requireAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/firebase-admin';
import { runContenido, publicarContenido } from '@/lib/contenidoRun';

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

// Admin. { id } = publicar un borrador ya generado. Si no: generar una pieza (ignora el interruptor),
// con { serieId } opcional y { publicar } (default false = vista previa).
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.id === 'string') return Response.json({ ok: true, ...(await publicarContenido(getDb(), body.id)) });
    const result = await runContenido({
      force: true,
      serieId: typeof body?.serieId === 'string' ? body.serieId : null,
      publicar: body?.publicar === true,
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
