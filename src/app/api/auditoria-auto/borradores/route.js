export const dynamic = 'force-dynamic';
export const maxDuration = 120; // aprobar = resumen con Gemini + captura de Microlink + Make

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { listarBorradores, aprobarBorrador, descartarBorrador, ReviewError } from '@/lib/autoAuditReview';

const NETWORKS = ['linkedin', 'instagram', 'facebook'];

// GET ?estado=pendiente|publicado|descartado|todos → borradores de la auditoría automática.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
  const estado = new URL(request.url).searchParams.get('estado') || 'pendiente';
  try {
    return Response.json({ items: await listarBorradores(db, { estado, limit: 30 }) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST { id, accion: 'aprobar' | 'descartar', redes?, networks?, excluir?, motivo? }
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
  try {
    const body = await request.json();
    if (body?.accion === 'descartar') {
      return Response.json(await descartarBorrador(db, body.id, body.motivo));
    }
    if (body?.accion !== 'aprobar') return Response.json({ error: 'accion: aprobar o descartar' }, { status: 400 });
    const networks = Array.isArray(body.networks) ? body.networks.filter(n => NETWORKS.includes(n)) : undefined;
    const excluir = Array.isArray(body.excluir) ? body.excluir.filter(x => typeof x === 'string') : [];
    const out = await aprobarBorrador(db, body.id, { redes: body.redes !== false, networks, excluir });
    revalidatePath('/auditorias');
    revalidatePath('/auditorias/[id]', 'page');
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e.message }, { status: e instanceof ReviewError ? 400 : 500 });
  }
}
