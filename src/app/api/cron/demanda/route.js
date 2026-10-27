export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 7 localidades × 65 rubros de autocompletado + captura de Microlink

import { requireAdmin } from '@/lib/adminAuth';
import { runDemandaAuto } from '@/lib/demandaAutoRun';

// Cron de Vercel (vercel.json, mar–vie 21:00 UTC = 18:00 ART): manda "Authorization: Bearer <CRON_SECRET>".
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    return Response.json({ ok: true, ...(await runDemandaAuto()) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// "Correr ahora" del admin: ignora el interruptor. Body opcional { zonaId, publicar }.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runDemandaAuto({
      force: true,
      zonaId: typeof body?.zonaId === 'string' ? body.zonaId : null,
      publicar: body?.publicar !== false,
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
