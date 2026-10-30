export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { loadContenidoConfig, CONTENIDOS } from '@/lib/contenidoRun';
import { validateContenidoPatch } from '@/lib/contenido';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const config = await loadContenidoConfig(db);
    const snap = await db.collection(CONTENIDOS).orderBy('createdAtMs', 'desc').limit(30).get();
    const items = snap.docs.map(d => {
      const c = d.data();
      return {
        id: d.id, serie: c.serieNombre, titulo: c.titulo, estado: c.estado, imagenes: c.imagenes || [],
        caption: c.caption, proveedor: c.proveedor, error: c.error || null, redes: c.redes || null,
        createdAtMs: c.createdAtMs, publicadoAtMs: c.publicadoAtMs || null,
        tema: c.tema || null, reelId: c.reelId || null, reelPedido: c.reelPedido === true,
      };
    });
    return Response.json({ config, items });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Body inválido' }, { status: 400 });
    const { update, error } = validateContenidoPatch(body);
    if (error) return Response.json({ error }, { status: 400 });
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    await db.collection('contenido_config').doc('settings').set(update, { merge: true });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
