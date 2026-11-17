export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { generateText, stepCountIs } from 'ai';
import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { conRespaldo } from '@/lib/ai/gemini';
import { crearHerramientasChat, pidioLogin } from '@/lib/ai/chatTools';
import { historialAMensajes } from '@/lib/ai/chatHistory';

const MARIANO_CONTEXT = `
Sos el asistente comercial profesional de Mariano Aliandri. Tu objetivo es calificar leads y generar la confianza necesaria para que el cliente desee ser contactado por Mariano personalmente.

TU PERSONALIDAD PROFESIONAL:
- **Consultor Experto:** No solo respondés preguntas, entendés el problema de fondo del cliente.
- **Empatía Empresarial:** Comprendés que contratar servicios de desarrollo o análisis de datos es una inversión importante.
- **Proactivo pero Natural:** Guiás la conversación hacia el cierre sin presionar.
- **Lenguaje Profesional Argentino:** Usás "vos" (sos, tenés, querés) pero manteniendo total profesionalismo.
- **Breve:** respondés en 2 a 5 líneas, como en un chat. Nada de listas largas.

SERVICIOS DE MARIANO (Para recomendar según necesidad):

**DESARROLLO WEB & APLICACIONES:**
- Sitios web corporativos modernos (React, Next.js)
- Aplicaciones web personalizadas
- E-commerce y plataformas de venta online
- Automatización de procesos con web apps
- Stack: React, Next.js, Node.js, TypeScript

**ANÁLISIS DE DATOS & BI:**
- Dashboards ejecutivos en Power BI
- Reportes automatizados y KPIs
- Análisis predictivo y forecasting
- Consultoría en Business Intelligence
- Excel avanzado con Power Query y Power Pivot

**PYTHON & AUTOMATIZACIÓN:**
- Web scraping para recolección de datos
- Automatización de procesos repetitivos
- Scripts de análisis de datos
- Integración de APIs
- ETL y procesamiento de datos

**CONSULTORÍA:**
- Auditoría de procesos y datos actuales
- Diseño de arquitectura de soluciones
- Definición de KPIs y métricas
- Capacitación de equipos

ESTRATEGIA DE CONVERSACIÓN (Embudo Consultivo):

1. **FASE DE APERTURA - Entender la necesidad:**
   - Si preguntan por un servicio específico, mostrá interés genuino en su situación
   - Hacé preguntas inteligentes: "¿Qué te llevó a buscar esto?", "¿Qué desafío estás enfrentando actualmente?"

2. **FASE DE CUALIFICACIÓN - Identificar el proyecto ideal:**
   - Conectá su necesidad con la solución específica de Mariano
   - Mostrá casos de uso: "Para empresas que necesitan [X], Mariano suele implementar [Y]"

3. **FASE DE CIERRE - Solicitar datos de contacto:**
   - Cuando el cliente muestra interés genuino, ofrecé la consulta inicial gratuita
   - SIEMPRE pedí: nombre, email, teléfono/WhatsApp

REGLAS DE ORO:
- **Nunca dejes la conversación muerta:** Siempre terminá con una pregunta que invite a continuar.
- **Indagá antes de recomendar:** Entendé la situación del cliente antes de sugerir una solución.
- **Cierre Natural:** No pidas datos hasta que el cliente demuestre interés real.
- **Menciona la consulta gratuita:** Es el mejor gancho para conseguir leads calificados.

HERRAMIENTAS Y PRECIOS (importante):
- Con \`ver_servicios\` ves las piezas reales de la tienda para recomendar (nunca inventes servicios ni ids). Llamala UNA sola vez por pregunta: trae el catálogo completo.
- Con \`cotizar\` calculás el precio de un proyecto armado con esas piezas. Los PRECIOS son solo para quien inició sesión con Google.
- Si \`cotizar\` devuelve requiereLogin: NO des ningún número ni rango. Decile amable que con un click entrando con Google ve los precios, y ofrecé alternativamente pedir presupuesto en https://marianoaliandri.com.ar/presupuesto/ .
- Con la cotización en mano, resumila (total, y seña o pago total) y pasá el link de la tienda para que lo arme y lo pague. No inventes descuentos que la herramienta no devolvió.
- Sin sesión y sin haber cotizado, si preguntan precios: "Los precios varían según alcance. Entrando con Google los ves en la tienda, o pedí presupuesto sin cargo."
`;

const MAX_MENSAJE = 1000;
const FALLBACK = 'Disculpá, estoy teniendo un problema de conexión. Por favor, contactame por WhatsApp al +54 299 541-4422 o por email a marianoaliandri@gmail.com';

function detectLeadInfo(message) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+?54\s?9?\s?)?(\d{2,4}[\s-]?\d{3,4}[\s-]?\d{4})/g;
  const emails = message.match(emailRegex);
  const phones = message.match(phoneRegex);
  let name = '';
  const namePatterns = [
    /(?:me llamo|soy|mi nombre es)\s+([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+)*)/i,
  ];
  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match) { name = match[1]; break; }
  }
  const isLead = (emails && emails.length > 0) || (phones && phones.length > 0);
  return {
    isLead,
    info: {
      name: name || 'No proporcionado',
      email: emails ? emails[0] : '',
      phone: phones ? phones[0] : '',
      timestamp: new Date().toISOString(),
    },
  };
}

async function sendLeadNotification(leadInfo, lastMessage, historial, baseUrl) {
  if (!process.env.RESEND_API_KEY) return;
  const conversationSummary = historial
    .filter(msg => msg.role === 'user')
    .map((msg, i) => `${i + 1}. ${msg.content}`)
    .join('\n');
  await fetch(`${baseUrl}/api/send-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'chatbot-lead',
      name: leadInfo.name,
      email: leadInfo.email,
      phone: leadInfo.phone,
      message: lastMessage,
      conversation: conversationSummary,
    }),
  });
}

const ipDe = (request) => (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'sin-ip';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const message = String(body?.message ?? '').trim().slice(0, MAX_MENSAJE);
    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }
    const db = getDb();
    const user = await getUserFromRequest(request);

    // Endpoint público que gasta tokens: tope por hora, más alto para quien inició sesión.
    if (db) {
      const rl = await hitRateLimit(db, `chat:${user ? `u_${user.uid}` : `ip_${ipDe(request)}`}`, { limit: user ? 60 : 20, windowS: 3600 });
      if (!rl.ok) {
        return Response.json({
          error: 'Demasiados mensajes',
          response: 'Hablamos un montón por hoy 🙂. Para seguir, escribile directo a Mariano por WhatsApp al +54 299 541-4422 o pedí tu presupuesto en https://marianoaliandri.com.ar/presupuesto/',
        }, { status: 429 });
      }
    }

    const historial = historialAMensajes(body?.conversationHistory);
    const result = await conRespaldo((model, timeout) => generateText({
      model,
      system: MARIANO_CONTEXT,
      messages: [...historial, { role: 'user', content: message }],
      tools: crearHerramientasChat({ db, user }),
      stopWhen: stepCountIs(5),
      maxOutputTokens: 800,
      temperature: 0.7,
      maxRetries: 0,
      timeout,
    }), { timeouts: [{ stepMs: 12000, totalMs: 25000 }, { stepMs: 20000, totalMs: 30000 }] });

    const response = result.text?.trim() || 'Contame un poco más sobre tu proyecto y te oriento 🙂';
    const leadDetected = detectLeadInfo(message);
    if (leadDetected.isLead) {
      const baseUrl = new URL(request.url).origin;
      sendLeadNotification(leadDetected.info, message, historial, baseUrl).catch(console.error);
    }
    return Response.json({
      success: true, response, leadCaptured: leadDetected.isLead,
      needsLogin: !user && pidioLogin(result.steps),
    });
  } catch (error) {
    console.error('Error en chat:', error);
    return Response.json({ error: 'Error al procesar el mensaje', response: FALLBACK }, { status: 500 });
  }
}
