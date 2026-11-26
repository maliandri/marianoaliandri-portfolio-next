export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { generateText, stepCountIs } from 'ai';
import { getDb } from '@/lib/firebase-admin';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { conRespaldo } from '@/lib/ai/gemini';
import { historialAMensajes } from '@/lib/ai/chatHistory';
import { claveValida } from '@/lib/auditClave';
import { contextoAsesor, herramientasAsesor, formularioDe, sinMontos } from '@/lib/ai/auditAsesor';
import { sendTelegram } from '@/lib/telegram';
import { auditoriaLink } from '@/lib/auditPitch';

const MAX_MENSAJE = 1000;
const FALLBACK = 'Uy, no pude responderte ahora. Probá de nuevo en un ratito o escribile a Mariano por WhatsApp al +54 9 299 541-4422.';
const ipDe = (request) => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip';

// Chat del informe privado. POST { id, k, para, mensaje, historial: [{ rol, texto }] }
// → { respuesta, formulario: { servicios } | null }. Sin la clave del informe: 404.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mensaje = String(body?.mensaje ?? '').trim().slice(0, MAX_MENSAJE);
    const id = String(body?.id || '');
    if (!mensaje || !id || id.includes('/')) return Response.json({ error: 'Faltan datos' }, { status: 400 });

    const db = getDb();
    if (!db) return Response.json({ respuesta: FALLBACK, formulario: null }, { status: 500 });
    const snap = await db.collection('auditorias').doc(id).get();
    if (!snap.exists || !claveValida(snap.data(), body?.k)) return Response.json({ error: 'No encontrado' }, { status: 404 });
    const auditoria = snap.data();
    const negocioId = String(body?.para || '').slice(0, 200) || null;

    const rl = await hitRateLimit(db, `audit-asesor:${ipDe(request)}`, { limit: 30, windowS: 3600 });
    if (!rl.ok) {
      return Response.json({ respuesta: 'Charlamos un montón por hoy 🙂. Dejame tu contacto con el botón de abajo y Mariano te escribe.', formulario: { servicios: [] } }, { status: 429 });
    }

    const crudo = Array.isArray(body?.historial) ? body.historial : [];
    const historial = historialAMensajes(crudo
      .map(m => ({ role: m?.rol === 'asistente' ? 'model' : 'user', parts: [{ text: String(m?.texto || '') }] })));

    // Primer mensaje del cliente: aviso a Mariano (no bloquea la respuesta si falla).
    if (!crudo.some(m => m?.rol === 'cliente')) {
      const neg = (auditoria.results || []).find(r => r.id === negocioId);
      sendTelegram({
        texto: `💬 ${neg?.nombre || 'Alguien'} está hablando con el asistente de su auditoría (${auditoria.title || id}).\n\n"${mensaje.slice(0, 300)}"`,
        botones: [{ texto: 'Ver el informe', url: auditoriaLink(id, negocioId, auditoria.clave) }],
      }).catch(() => {});
    }

    const result = await conRespaldo((model, timeout) => generateText({
      model,
      system: contextoAsesor({ auditoria, negocioId }),
      messages: [...historial, { role: 'user', content: mensaje }],
      tools: herramientasAsesor(),
      stopWhen: stepCountIs(3),
      maxOutputTokens: 700,
      temperature: 0.6,
      maxRetries: 0,
      timeout,
    }), { timeouts: [{ stepMs: 12000, totalMs: 25000 }, { stepMs: 20000, totalMs: 30000 }] });

    const formulario = formularioDe(result.steps);
    const respuesta = sinMontos(result.text?.trim()
      || (formulario ? 'Genial. Dejame tu nombre y cómo te contactamos acá abajo, y Mariano te escribe hoy.' : '¿Me contás un poco más de tu negocio así te oriento?'));
    return Response.json({ respuesta, formulario }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[auditorias/asesor]', e?.message);
    return Response.json({ respuesta: FALLBACK, formulario: null }, { status: 500 });
  }
}
