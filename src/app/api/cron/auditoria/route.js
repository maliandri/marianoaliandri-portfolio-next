export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby: tope seguro. La corrida manual usa el modo rápido (15 s, sin Gemini).

import { requireAdmin } from '@/lib/adminAuth';
import { runAutoAudit } from '@/lib/autoAuditRun';

// "Correr ahora" del admin. La ejecución programada NO pasa por acá: corre en GitHub Actions
// (scripts/auto-audit.mjs). force:true ignora el interruptor `activo`.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const result = await // Modo rápido: Vercel Hobby corta a los 60 s, así que lote corto y resumen de plantilla
    // (sin Gemini). La corrida programada va por GitHub Actions con el presupuesto completo.
    runAutoAudit({ force: true, budgetMs: 15000, maxSites: 8, maxCandidates: 20, useGemini: false });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
