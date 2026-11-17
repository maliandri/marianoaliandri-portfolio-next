export const dynamic = 'force-dynamic';
export const maxDuration = 300; // el agente busca, espera la búsqueda y redacta: puede tardar varios minutos

import { requireAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/firebase-admin';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { correrAgenteProspeccion } from '@/lib/ai/prospectingAgent';
import { alertError } from '@/lib/alert';

// Solo admin. { objetivo } → corre el agente y devuelve { texto, pasos, borradores }. Los borradores quedan
// guardados (mcp_email_drafts, 7 días) y se envían de a uno desde /api/agente-prospeccion/enviar/.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const objetivo = String(body?.objetivo ?? '').trim();
  if (objetivo.length < 10) return Response.json({ error: 'Contale al agente qué querés lograr (rubro, zona, qué tipo de negocio).' }, { status: 400 });

  // Freno contra un bucle o un doble clic: cada corrida gasta tokens y puede gastar cupo de Places.
  const rl = await hitRateLimit(db, `agente:${auth.user.uid}`, { limit: 10, windowS: 3600 });
  if (!rl.ok) return Response.json({ error: `Demasiadas corridas seguidas, reintentá en ${Math.ceil(rl.retryAfterS / 60)} min.` }, { status: 429 });

  try {
    const r = await correrAgenteProspeccion({ db, user: { uid: auth.user.uid, email: auth.user.email }, objetivo });
    return Response.json({ ok: true, ...r });
  } catch (e) {
    await alertError('agente-prospeccion:error', 'Agente de prospección: falló la corrida', e, { objetivo: objetivo.slice(0, 120) });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
