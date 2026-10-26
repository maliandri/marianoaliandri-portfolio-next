export const dynamic = 'force-dynamic';

import { getUserFromRequest } from '@/lib/authServer';
import { runLeadFinderProAction } from '@/lib/leadFinderPro';

// El conteo de productos rastrea varios archivos del sitio del negocio (presupuesto
// interno ~20 s), más que un fetch normal.
export const maxDuration = 30;

// La lógica (acciones gratis, cobro por lead, historial) vive en src/lib/leadFinderPro.js,
// compartida con el servidor MCP.
export async function POST(request) {
  const authUser = await getUserFromRequest(request);
  if (!authUser) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }

  const { status, body: out } = await runLeadFinderProAction(authUser, body);
  return Response.json(out, { status });
}
