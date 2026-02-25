export const dynamic = 'force-dynamic';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MARIANO_CONTEXT = `
Sos el asistente comercial profesional de Mariano Aliandri. Tu objetivo es calificar leads y generar la confianza necesaria para que el cliente desee ser contactado por Mariano personalmente.

TU PERSONALIDAD PROFESIONAL:
- **Consultor Experto:** No solo respondés preguntas, entendés el problema de fondo del cliente.
- **Empatía Empresarial:** Comprendés que contratar servicios de desarrollo o análisis de datos es una inversión importante.
- **Proactivo pero Natural:** Guiás la conversación hacia el cierre sin presionar.
- **Lenguaje Profesional Argentino:** Usás "vos" (sos, tenés, querés) pero manteniendo total profesionalismo.

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

Si preguntan precios exactos: "Los precios varían según alcance y complejidad. En la consulta inicial gratuita, Mariano evalúa tu proyecto y te da un presupuesto personalizado. ¿Coordinamos esa llamada?"
`;

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

async function sendLeadNotification(leadInfo, lastMessage, conversationHistory, baseUrl) {
  if (!process.env.RESEND_API_KEY) return;
  const conversationSummary = conversationHistory
    .filter(msg => msg.role === 'user')
    .map((msg, i) => `${i + 1}. ${msg.parts[0].text}`)
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

export async function POST(request) {
  try {
    const { message, conversationHistory = [] } = await request.json();
    if (!message) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }
    if (!process.env.GEMINI_API_KEY) {
      return Response.json({
        error: 'API key no configurada',
        response: 'El chatbot no está disponible temporalmente. Por favor, contactame por WhatsApp al +54 299 541-4422 o por email a marianoaliandri@gmail.com',
      }, { status: 500 });
    }
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 800 },
    });
    let history = [
      { role: 'user', parts: [{ text: MARIANO_CONTEXT }] },
      { role: 'model', parts: [{ text: 'Comprendido. Soy el asistente virtual de Mariano Aliandri.' }] },
    ];
    if (conversationHistory && conversationHistory.length > 0) {
      history = [...history, ...conversationHistory.map(msg => ({ role: msg.role, parts: msg.parts }))];
    }
    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    const response = await result.response.text();
    const leadDetected = detectLeadInfo(message);
    if (leadDetected.isLead) {
      const baseUrl = new URL(request.url).origin;
      sendLeadNotification(leadDetected.info, message, conversationHistory, baseUrl).catch(console.error);
    }
    return Response.json({ success: true, response, leadCaptured: leadDetected.isLead });
  } catch (error) {
    console.error('Error en chat:', error);
    return Response.json({
      error: 'Error al procesar el mensaje',
      response: 'Disculpá, estoy teniendo un problema de conexión. Por favor, contactame por WhatsApp al +54 299 541-4422 o por email a marianoaliandri@gmail.com',
      details: error.message,
    }, { status: 500 });
  }
}
