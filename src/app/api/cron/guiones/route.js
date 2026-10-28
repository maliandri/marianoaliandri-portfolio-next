export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/adminAuth';
import { buildPromptGuiones, parseGuiones, guionesHtml } from '@/lib/guiones';
import { generarConRespaldo, loadContenidoConfig } from '@/lib/contenidoRun';
import { statsAuditorias } from '@/lib/contenido';
import { sendViaResend } from '@/lib/bizEmail';
import { alertError } from '@/lib/alert';

// Lunes 11:00 UTC (08:00 ART, vercel.json): 3 guiones de reels para grabar con la cara, por mail.
// POST (admin) = mandarlos ahora.
async function armarYMandar() {
  const db = getDb();
  const [config, auds, dem, prev] = await Promise.all([
    loadContenidoConfig(db),
    db.collection('auditorias').orderBy('createdAt', 'desc').limit(25).get(),
    db.collection('demanda_reportes').orderBy('createdAtMs', 'desc').limit(1).get(),
    db.collection('guiones_semana').orderBy('createdAtMs', 'desc').limit(3).get(),
  ]);
  const d = dem.docs[0]?.data();
  const { guiones, proveedor } = await generarConRespaldo(buildPromptGuiones({
    series: config.series,
    auditorias: statsAuditorias(auds.docs.map(x => x.data())),
    demanda: d ? { zona: d.zona, top: d.top.slice(0, 5).map(t => t.label), frase: d.top[0]?.ejemplos?.[0] } : null,
    recientes: prev.docs.flatMap(x => x.data().guiones?.map(g => g.titulo) || []),
  }), parseGuiones);
  const semana = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
  const to = process.env.ALERT_EMAIL || process.env.ADMIN_EMAIL;
  if (!to) throw new Error('Falta ADMIN_EMAIL');
  await sendViaResend({ to, subject: `🎬 Tus 3 reels de la semana (${semana})`, html: guionesHtml(guiones, { semana }) });
  await db.collection('guiones_semana').add({ guiones, proveedor, createdAtMs: Date.now(), createdAt: FieldValue.serverTimestamp() });
  return { enviados: guiones.length, titulos: guiones.map(g => g.titulo) };
}

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return Response.json({ ok: true, ...(await armarYMandar()) });
  } catch (e) {
    await alertError('guiones', 'No salieron los guiones de reels de la semana', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    return Response.json({ ok: true, ...(await armarYMandar()) });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
