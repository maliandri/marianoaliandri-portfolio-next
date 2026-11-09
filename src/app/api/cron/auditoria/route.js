export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Hobby: tope seguro. La corrida manual usa el modo rápido (15 s, sin Gemini).

import { requireAdmin } from '@/lib/adminAuth';
import { runAutoAudit } from '@/lib/autoAuditRun';

// "Correr ahora" del admin. La ejecución programada NO pasa por acá: corre en GitHub Actions
// (scripts/auto-audit.mjs). force:true ignora el interruptor `activo`. Body opcional { ciudad, rubro }
// (nombres de la configuración): audita esa combinación en vez de la que toca.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  // El cuerpo es opcional: sin él (o inválido) corre la combinación que toca.
  let body = {};
  try { body = await request.json(); } catch { /* sin cuerpo */ }
  const ciudad = typeof body?.ciudad === 'string' && body.ciudad.trim() ? body.ciudad.trim() : null;
  const rubro = typeof body?.rubro === 'string' && body.rubro.trim() ? body.rubro.trim() : null;

  try {
    // Modo rápido: Vercel Hobby corta a los 60 s, así que lote corto (como máximo 8 sitios) y
    // resumen de plantilla (sin Gemini). La corrida programada va por GitHub Actions.
    const result = await runAutoAudit({ force: true, budgetMs: 15000, fast: true, useGemini: false, ...(ciudad ? { ciudad } : {}), ...(rubro ? { rubro } : {}) });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
