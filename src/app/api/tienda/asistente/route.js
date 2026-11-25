export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { generateText, stepCountIs } from 'ai';
import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { conRespaldo } from '@/lib/ai/gemini';
import { historialAMensajes } from '@/lib/ai/chatHistory';
import { contextoAsistente, herramientasAsistente, sinMontos, accionesDe } from '@/lib/ai/tiendaAsistente';
import { cargarCatalogo } from '@/lib/tiendaCheckout';
import { cargarContexto } from '@/lib/tiendaCatalogo';

const MAX_MENSAJE = 1000;
const FALLBACK = 'Uy, no pude responderte ahora. Probá de nuevo en un ratito o escribile a Mariano por WhatsApp al +54 9 299 541-4422.';
const ipDe = (request) => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip';

// Asistente de la tienda (venta por consulta). POST { mensaje, historial: [{ rol, texto }], marcados: [ids] }
// → { respuesta, acciones: [{ accion: 'sumar'|'sacar', id }] }. Nunca devuelve precios.
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const mensaje = String(body?.mensaje ?? '').trim().slice(0, MAX_MENSAJE);
    if (!mensaje) return Response.json({ error: 'Falta el mensaje' }, { status: 400 });
    const marcados = (Array.isArray(body?.marcados) ? body.marcados : []).map(String).slice(0, 60);

    const db = getDb();
    const user = await getUserFromRequest(request).catch(() => null);
    const rl = await hitRateLimit(db, `tienda-asistente:${user ? `u_${user.uid}` : `ip_${ipDe(request)}`}`, { limit: user ? 60 : 20, windowS: 3600 });
    if (!rl.ok) {
      return Response.json({ respuesta: 'Charlamos un montón por hoy 🙂. Pedí el presupuesto con lo que marcaste y lo seguimos con Mariano en la reunión.', acciones: [] }, { status: 429 });
    }

    const [catalogo, contextoGeneral] = await Promise.all([cargarCatalogo(db), cargarContexto(db)]);
    const historial = historialAMensajes((Array.isArray(body?.historial) ? body.historial : [])
      .map(m => ({ role: m?.rol === 'asistente' ? 'model' : 'user', parts: [{ text: String(m?.texto || '') }] })));

    const result = await conRespaldo((model, timeout) => generateText({
      model,
      system: contextoAsistente({ catalogo, contextoGeneral, marcados }),
      messages: [...historial, { role: 'user', content: mensaje }],
      tools: herramientasAsistente({ catalogo }),
      stopWhen: stepCountIs(4),
      maxOutputTokens: 600,
      temperature: 0.5,
      maxRetries: 0,
      timeout,
    }), { timeouts: [{ stepMs: 12000, totalMs: 25000 }, { stepMs: 20000, totalMs: 30000 }] });

    const respuesta = sinMontos(result.text?.trim() || '¿Me contás un poco más de tu negocio así te oriento?');
    return Response.json({ respuesta, acciones: accionesDe(result.steps) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[tienda/asistente]', e?.message);
    return Response.json({ respuesta: FALLBACK, acciones: [] }, { status: 500 });
  }
}
