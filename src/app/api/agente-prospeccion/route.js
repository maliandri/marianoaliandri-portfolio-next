export const dynamic = 'force-dynamic';
export const maxDuration = 300; // el agente busca, espera la búsqueda y redacta: puede tardar varios minutos

import { after } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/firebase-admin';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { correrAgenteProspeccion } from '@/lib/ai/prospectingAgent';
import { crearRun, crearRegistrador, corridaActiva, leerRun, listarRuns } from '@/lib/ai/agentRuns';
import { alertError } from '@/lib/alert';

// Solo admin.
//  POST { objetivo }  → crea la corrida, arranca el agente en segundo plano y responde { runId } al instante.
//  GET ?id=<runId>&desde=<seq> → estado de la corrida + eventos nuevos (para el visor, se consulta cada ~2 s).
//  GET (sin id)       → últimas corridas.
// Los borradores quedan en mcp_email_drafts (7 días) y se envían de a uno con /api/agente-prospeccion/enviar/.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const objetivo = String(body?.objetivo ?? '').trim();
  if (objetivo.length < 10) return Response.json({ error: 'Contale al agente qué querés lograr (rubro, zona, qué tipo de negocio).' }, { status: 400 });

  // Un solo agente a la vez: dos corridas juntas duplicarían búsquedas que gastan cupo de Places.
  const activa = await corridaActiva(db);
  if (activa) return Response.json({ error: 'Ya hay una corrida en curso.', runId: activa.id }, { status: 409 });

  // Freno contra un bucle o un doble clic: cada corrida gasta tokens y puede gastar cupo de Places.
  const rl = await hitRateLimit(db, `agente:${auth.user.uid}`, { limit: 10, windowS: 3600 });
  if (!rl.ok) return Response.json({ error: `Demasiadas corridas seguidas, reintentá en ${Math.ceil(rl.retryAfterS / 60)} min.` }, { status: 429 });

  const user = { uid: auth.user.uid, email: auth.user.email };
  const runId = await crearRun(db, { uid: user.uid, objetivo });
  const reg = crearRegistrador(db, runId);

  after(async () => {
    try {
      const r = await correrAgenteProspeccion({ db, user, objetivo, onEvento: reg.evento });
      reg.evento({ tipo: 'fin', texto: 'Terminó.' });
      await reg.cerrar({ estado: 'listo', texto: r.texto, borradores: r.borradores, pasos: r.pasos.length });
    } catch (e) {
      reg.evento({ tipo: 'error', texto: e.message });
      await reg.cerrar({ estado: 'error', error: e.message }).catch(() => {});
      await alertError('agente-prospeccion:error', 'Agente de prospección: falló la corrida', e, { objetivo: objetivo.slice(0, 120) });
    }
  });

  return Response.json({ ok: true, runId });
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ ok: true, runs: await listarRuns(db, { uid: auth.user.uid }) });

  const run = await leerRun(db, id, { desde: Number(searchParams.get('desde')) || 0 });
  if (!run || run.uid !== auth.user.uid) return Response.json({ error: 'No existe esa corrida' }, { status: 404 });
  return Response.json({ ok: true, run });
}
