export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby: tope seguro. La corrida manual usa el presupuesto corto (45 s).

import { requireAdmin } from '@/lib/adminAuth';
import { runAutoAudit } from '@/lib/autoAuditRun';

// "Correr ahora" del admin. La ejecución programada NO pasa por acá: corre en GitHub Actions
// (scripts/auto-audit.mjs). force:true ignora el interruptor `activo`.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const result = await runAutoAudit({ force: true });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
