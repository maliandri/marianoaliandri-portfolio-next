export const dynamic = 'force-dynamic';

import { checkInstagram, checkMercadoPago } from '@/lib/healthCheck';
import { sendAlert } from '@/lib/alert';

// Cron diario de Vercel (vercel.json): manda "Authorization: Bearer <CRON_SECRET>".
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  const checks = {};
  for (const [name, fn] of [['instagram', checkInstagram], ['mercadopago', checkMercadoPago]]) {
    try { checks[name] = await fn(); } catch (e) { checks[name] = { ok: false, problems: [`El chequeo falló: ${e.message}`] }; }
  }

  const problems = Object.entries(checks).flatMap(([name, c]) => c.problems.map(p => `${name}: ${p}`));
  if (problems.length) {
    await sendAlert({ key: `health:${problems.join('|').slice(0, 100)}`, titulo: 'Chequeo diario: hay credenciales con problemas', detalle: problems.join('\n') });
  }
  return Response.json({ ok: problems.length === 0, checks });
}
