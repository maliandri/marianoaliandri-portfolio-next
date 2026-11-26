export const dynamic = 'force-dynamic';

import { FieldValue } from 'firebase-admin/firestore';
import { getDb } from '@/lib/firebase-admin';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { claveValida } from '@/lib/auditClave';
import { sendTelegram } from '@/lib/telegram';
import { SERVICIOS_OFERTA, auditoriaLink, whatsappUrl } from '@/lib/auditPitch';
import { PRESUPUESTOS } from '@/lib/tiendaCheckout';

const ipDe = (request) => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip';
const txt = (v, max) => String(v ?? '').trim().slice(0, max);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pedido de presupuesto desde el informe privado (sin login: el link ya es personal).
// POST { id, k, para, nombre, contacto (WhatsApp o email), mensaje, servicios: [ids], chat: [{ rol, texto }] }
// Queda en `presupuestos` (origen 'auditoria') para el admin y el MCP, y avisa por Telegram.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = txt(body?.id, 60);
    const nombre = txt(body?.nombre, 120);
    const contacto = txt(body?.contacto, 120);
    if (!id || id.includes('/')) return Response.json({ error: 'Faltan datos' }, { status: 400 });
    if (!nombre || !contacto) return Response.json({ error: 'Dejanos tu nombre y un WhatsApp o email' }, { status: 400 });
    const esEmail = EMAIL.test(contacto);
    const telefono = esEmail ? '' : contacto.replace(/[^\d+]/g, '');
    if (!esEmail && telefono.replace(/\D/g, '').length < 8) return Response.json({ error: 'Ese WhatsApp o email no parece válido' }, { status: 400 });

    const db = getDb();
    if (!db) return Response.json({ error: 'No disponible' }, { status: 500 });
    const snap = await db.collection('auditorias').doc(id).get();
    if (!snap.exists || !claveValida(snap.data(), body?.k)) return Response.json({ error: 'No encontrado' }, { status: 404 });
    const auditoria = snap.data();

    const rl = await hitRateLimit(db, `audit-solicitud:${ipDe(request)}`, { limit: 5, windowS: 3600 });
    if (!rl.ok) return Response.json({ error: 'Ya recibimos tu pedido, Mariano te escribe pronto.' }, { status: 429 });

    const negocioId = txt(body?.para, 200) || null;
    const neg = (auditoria.results || []).find(r => r.id === negocioId) || null;
    const porId = new Map(SERVICIOS_OFERTA.map(s => [s.id, s]));
    const servicios = [...new Set((Array.isArray(body?.servicios) ? body.servicios : []).map(String))].filter(s => porId.has(s));
    const chat = (Array.isArray(body?.chat) ? body.chat : [])
      .filter(m => m && (m.rol === 'cliente' || m.rol === 'asistente') && String(m.texto || '').trim())
      .slice(-20).map(m => ({ rol: m.rol, texto: txt(m.texto, 500) }));

    const ref = await db.collection(PRESUPUESTOS).add({
      clientName: nombre,
      clientEmail: esEmail ? contacto.toLowerCase() : '',
      clientPhone: telefono,
      clientCompany: neg?.nombre || '',
      projectDescription: txt(body?.mensaje, 1500),
      deadline: '',
      selectedServices: servicios.map(s => porId.get(s).titulo),
      servicioIds: servicios,
      origen: 'auditoria',
      source: 'auditoria',
      auditoriaId: id,
      negocioId,
      negocioWeb: neg?.siteUrl || null,
      status: 'pending',
      chat,
      adminNotes: '',
      createdAtMs: Date.now(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const botones = [{ texto: 'Ver el informe', url: auditoriaLink(id, negocioId, auditoria.clave) }];
    if (telefono) botones.unshift({ texto: 'Escribirle por WhatsApp', url: whatsappUrl(telefono, `Hola ${nombre}, soy Mariano. Recibí tu pedido desde la auditoría.`) });
    await sendTelegram({
      texto: `🔥 Pedido de presupuesto desde una auditoría\n${nombre}${neg ? ` — ${neg.nombre}` : ''}\nContacto: ${contacto}\nServicios: ${servicios.map(s => porId.get(s).titulo).join(', ') || '—'}${body?.mensaje ? `\n\n"${txt(body.mensaje, 400)}"` : ''}`,
      botones,
    }).catch(() => {});

    return Response.json({ ok: true, id: ref.id }, { status: 201 });
  } catch (e) {
    console.error('[auditorias/solicitud]', e?.message);
    return Response.json({ error: 'No pudimos guardar el pedido. Escribile a Mariano por WhatsApp.' }, { status: 500 });
  }
}
