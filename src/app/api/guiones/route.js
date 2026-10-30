export const dynamic = 'force-dynamic';
export const maxDuration = 300; // generar pasa por la cadena de IAs con respaldo

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import {
  generarGuiones, regenerarGuion, actualizarGuion, listarGuiones, loadGuionesConfig,
} from '@/lib/guionesRun';
import { validateGuionesConfig, FORMATOS } from '@/lib/guiones';

// Admin → Bot de contenido → Guiones.
// GET: guiones (los últimos 60) + config. POST: { tema?, cantidad?, formato?, mail? } genera; { regenerar: id } rehace uno.
// PATCH: { id, ...campos o estado } edita uno; { config: { cantidad, dias, mail } } guarda cuándo salen solos.
async function conAdmin(request, fn) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    return Response.json(await fn(db));
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}

export const GET = (request) => conAdmin(request, async (db) => ({
  guiones: await listarGuiones(db, { limit: 60 }),
  config: await loadGuionesConfig(db),
  formatos: FORMATOS,
}));

export const POST = (request) => conAdmin(request, async (db) => {
  const body = await request.json().catch(() => ({}));
  if (typeof body?.regenerar === 'string') return { guion: await regenerarGuion(db, body.regenerar) };
  return generarGuiones(db, {
    cantidad: body?.cantidad, tema: typeof body?.tema === 'string' ? body.tema.trim() : '',
    formato: typeof body?.formato === 'string' ? body.formato : '', mail: body?.mail === true, origen: 'admin',
  });
});

export const PATCH = (request) => conAdmin(request, async (db) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new Error('Body inválido');
  if (body.config) {
    const { update, error } = validateGuionesConfig(body.config);
    if (error) throw new Error(error);
    await db.collection('contenido_config').doc('settings').set({ guiones: update }, { merge: true });
    return { config: update };
  }
  if (typeof body.id !== 'string') throw new Error('Falta id');
  const { id, ...campos } = body;
  return { guion: await actualizarGuion(db, id, campos) };
});
