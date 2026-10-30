export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { generarGuiones, loadGuionesConfig } from '@/lib/guionesRun';
import { diaAR } from '@/lib/guiones';
import { alertError } from '@/lib/alert';

// Cron diario 11:00 UTC (08:00 ART, vercel.json): solo genera los días elegidos en el admin
// (contenido_config/settings.guiones.dias, default lunes), con la cantidad elegida, y los manda por mail.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'No autorizado' }, { status: 401 });
  try {
    const db = getDb();
    const cfg = await loadGuionesConfig(db);
    if (!cfg.dias.includes(diaAR(Date.now()))) return Response.json({ ok: true, skipped: 'no_toca_hoy' });
    const r = await generarGuiones(db, { cantidad: cfg.cantidad, mail: cfg.mail, origen: 'cron' });
    return Response.json({ ok: true, enviados: r.guiones.length, titulos: r.guiones.map(g => g.titulo) });
  } catch (e) {
    await alertError('guiones', 'No salieron los guiones de reels', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Admin: generar y mandar por mail ahora, con la config guardada.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    const cfg = await loadGuionesConfig(db);
    const r = await generarGuiones(db, { cantidad: cfg.cantidad, mail: true, origen: 'admin' });
    return Response.json({ ok: true, enviados: r.guiones.length, titulos: r.guiones.map(g => g.titulo) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
