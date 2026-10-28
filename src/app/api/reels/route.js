export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Instagram tarda en procesar el video antes de publicarlo

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { publicarReel, REELS } from '@/lib/reelPublish';

// Reels automáticos (los renderiza GitHub Actions, .github/workflows/reel-bot.yml).
// GET: config + últimos reels. PATCH { activo }: publicación automática. POST { id }: publicar un borrador.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    const [cfg, snap] = await Promise.all([
      db.collection('reels_config').doc('settings').get(),
      db.collection(REELS).orderBy('createdAtMs', 'desc').limit(12).get(),
    ]);
    const items = snap.docs.map(d => {
      const r = d.data();
      return { id: d.id, tipo: r.tipo, titulo: r.titulo, caption: r.caption, videoUrl: r.videoUrl, duracion: r.duracion, estado: r.estado, error: r.error || null, createdAtMs: r.createdAtMs };
    });
    return Response.json({ activo: cfg.data()?.activo === true, ultimoTipo: cfg.data()?.ultimoTipo || null, items });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const body = await request.json().catch(() => ({}));
  if (typeof body?.activo !== 'boolean') return Response.json({ error: 'activo debe ser boolean' }, { status: 400 });
  await getDb().collection('reels_config').doc('settings').set({ activo: body.activo }, { merge: true });
  return Response.json({ success: true });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.id !== 'string') return Response.json({ error: 'Falta el id del reel' }, { status: 400 });
    return Response.json({ ok: true, ...(await publicarReel(getDb(), body.id)) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
