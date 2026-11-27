export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { claveValida } from '@/lib/auditClave';
import { auditoriaLink } from '@/lib/auditPitch';
import { tokenOk, vistaCliente } from '@/lib/presupuestoCliente';
import { avisarUnaVez, botonWhatsapp, pesos } from '@/lib/avisos';

// Aviso a Telegram cuando un cliente abre el link privado que le mandó Mariano (2026-11-27):
//   { tipo: 'auditoria', id, k, para }      → "Ferretería X abrió su auditoría"
//   { tipo: 'presupuesto' | 'pagar', id, t } → "Juan abrió su presupuesto" / "Juan tocó Pagar"
// Lo llama el navegador (components/AvisoVista.jsx), no la página del servidor: los robots que arman la vista
// previa de un link en WhatsApp/Telegram no ejecutan JavaScript y no disparan avisos falsos. Valida la clave
// del link (sin clave correcta no avisa nada) y sale como mucho una vez por día por link.
export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  const id = typeof b?.id === 'string' ? b.id.slice(0, 100) : '';
  if (!id || id.includes('/')) return Response.json({ ok: false }, { status: 400 });
  const db = getDb();
  if (!db) return Response.json({ ok: false }, { status: 500 });
  const dia = new Date().toISOString().slice(0, 10);

  if (b.tipo === 'auditoria') {
    const snap = await db.collection('auditorias').doc(id).get().catch(() => null);
    const a = snap?.exists ? snap.data() : null;
    if (!a || !claveValida(a, b.k)) return Response.json({ ok: false }, { status: 404 });
    const para = typeof b.para === 'string' ? b.para.slice(0, 200) : '';
    const neg = para ? (a.results || []).find(r => r.id === para) : null;
    await avisarUnaVez(`vista:aud:${id}:${para || '-'}:${dia}`, {
      texto: [`👀 ${neg?.nombre || 'Alguien'} abrió su auditoría`, a.title, neg?.siteUrl,
        typeof neg?.seoScore === 'number' ? `Score SEO: ${neg.seoScore}` : ''].filter(Boolean).join('\n'),
      botones: [botonWhatsapp(neg?.whatsapp), { texto: 'Ver lo que ve', url: auditoriaLink(id, para || null, a.clave) }].filter(Boolean),
      tab: 'auditorias',
    }, { db });
    return Response.json({ ok: true });
  }

  if (b.tipo === 'presupuesto' || b.tipo === 'pagar') {
    const snap = await db.collection('presupuestos').doc(id).get().catch(() => null);
    const d = snap?.exists ? snap.data() : null;
    if (!d || !tokenOk(typeof b.t === 'string' ? b.t : '', d.pdfToken)) return Response.json({ ok: false }, { status: 404 });
    const v = vistaCliente(id, d);
    const quien = d.clientName || 'El cliente';
    const pagar = b.tipo === 'pagar';
    await avisarUnaVez(`vista:${pagar ? 'pagar' : 'pres'}:${id}:${dia}`, {
      texto: [pagar ? `💳 ${quien} tocó "Pagar" en su presupuesto` : `👀 ${quien} abrió su presupuesto`,
        `N° ${v.numero}${v.totalARS != null ? ` · ${pesos(v.totalARS)}` : ''}`].join('\n'),
      botones: [botonWhatsapp(d.clientPhone)].filter(Boolean),
      tab: 'presupuestos', sub: 'solicitudes',
    }, { db });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: false }, { status: 400 });
}
