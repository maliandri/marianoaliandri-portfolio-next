export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { requireAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/firebase-admin';
import { sendBusinessEmailTool } from '@/lib/mcp/tools/email';
import { ToolError } from '@/lib/mcp/defineTool';

// Solo admin. Aprobación humana de UN borrador del agente: { draftId, emailText?, dryRun? }. Pasa por el
// mismo handler que send_business_email del MCP, así siguen valiendo todos los frenos del servidor
// (lista de bajas y rebotes, 30 días sin repetir al mismo negocio, tope diario, link de baja firmado).
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const draftId = String(body?.draftId ?? '').trim();
  if (!draftId) return Response.json({ error: 'Falta draftId' }, { status: 400 });

  try {
    const { summary, data } = await sendBusinessEmailTool.handler({
      draft_id: draftId,
      ...(typeof body?.emailText === 'string' && body.emailText.trim() ? { email_text: body.emailText.trim() } : {}),
      ...(body?.dryRun === true ? { dry_run: true } : {}),
    }, { db, user: { uid: auth.user.uid, email: auth.user.email }, now: new Date() });
    return Response.json({ ok: true, summary, ...data });
  } catch (e) {
    if (e instanceof ToolError) return Response.json({ error: e.message }, { status: 400 });
    console.error('[agente-prospeccion] envío falló:', e);
    return Response.json({ error: 'No se pudo enviar el mail. Revisá los logs.' }, { status: 500 });
  }
}
