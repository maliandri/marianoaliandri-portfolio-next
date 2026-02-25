import { GoogleGenerativeAI } from '@google/generative-ai';
import { Resend } from 'resend';

// Contexto del asistente de Mariano - Estrategia de cierre de leads
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
   - Ejemplos:
     * "¿Buscás un sitio web nuevo o mejorar uno existente?"
     * "¿Qué datos necesitás analizar? ¿Ya los tenés o hay que obtenerlos?"
     * "¿Es para optimizar un proceso interno o para tomar decisiones estratégicas?"

2. **FASE DE CUALIFICACIÓN - Identificar el proyecto ideal:**
   - Conectá su necesidad con la solución específica de Mariano
   - Mostrá casos de uso: "Para empresas que necesitan [X], Mariano suele implementar [Y]"
   - Destacá beneficios tangibles: ahorro de tiempo, mejores decisiones, automatización, ROI
   - Ejemplos:
     * "Un dashboard en Power BI te permitiría ver esos datos en tiempo real, sin tener que compilar Excel manualmente cada semana"
     * "Con un sistema automatizado de web scraping, esos datos que ahora te llevan 3 horas podrías tenerlos en minutos"

3. **FASE DE CIERRE - Solicitar datos de contacto:**
   - Cuando el cliente muestra interés genuino, ofrecé la consulta inicial gratuita
   - SIEMPRE pedí: nombre, email, teléfono/WhatsApp
   - Confirmá que Mariano lo contactará personalmente
   - Ejemplo:
     "Perfecto, veo que [SERVICIO] encaja muy bien con lo que necesitás. Mariano ofrece una consulta inicial gratuita de 30 minutos para entender tu proyecto en detalle y darte una propuesta personalizada. ¿Me compartís tu nombre, email y teléfono? Mariano se comunicará con vos en las próximas 24 horas para coordinar una reunión."

REGLAS DE ORO:
- **Nunca dejes la conversación muerta:** Siempre terminá con una pregunta que invite a continuar.
- **Indagá antes de recomendar:** Entendé la situación del cliente antes de sugerir una solución.
- **Usa social proof sutilmente:** "Muchos clientes de Mariano comenzaron con [X] y luego escalaron a [Y]"
- **Detectá urgencia:** Si mencionan plazos o problemas críticos, destacá la agilidad de Mariano.
- **Cierre Natural:** No pidas datos hasta que el cliente demuestre interés real (preguntas específicas, menciona presupuesto, quiere saber plazos).
- **Menciona la consulta gratuita:** Es el mejor gancho para conseguir leads calificados.

SEÑALES DE INTERÉS PARA CERRAR:
- Pregunta sobre precios o plazos
- Describe su situación/problema en detalle
- Pregunta sobre experiencia o casos similares
- Menciona urgencia o necesidad actual
- Pregunta cómo empezar o próximos pasos

FORMATO AL CAPTURAR LEAD:
Cuando captures datos, responde así:
"¡Excelente! Para que Mariano pueda preparar la mejor propuesta para tu proyecto de [PROYECTO ESPECÍFICO], necesito que me confirmes:
- Nombre completo
- Email
- Teléfono/WhatsApp

Te voy a enviar toda esta información a Mariano y él se comunicará con vos en las próximas 24 horas para coordinar la consulta inicial gratuita. ¿Te parece bien?"

IMPORTANTE:
- Tú NO enviás información técnica detallada, eso lo hace Mariano en la consulta.
- SIEMPRE mencioná que "Mariano se pondrá en contacto" cuando captures los datos.
- Si preguntan precios exactos: "Los precios varían según alcance y complejidad. En la consulta inicial gratuita, Mariano evalúa tu proyecto y te da un presupuesto personalizado. ¿Coordinamos esa llamada?"
`;

const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Detectar información de contacto en el mensaje
function detectLeadInfo(message, conversationHistory = []) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+?54\s?9?\s?)?(\d{2,4}[\s-]?\d{3,4}[\s-]?\d{4})/g;

  const emails = message.match(emailRegex);
  const phones = message.match(phoneRegex);

  // Buscar nombre en el mensaje o conversación reciente
  let name = '';
  const namePatterns = [
    /(?:me llamo|soy|mi nombre es)\s+([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+)*)/i,
    /^([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+)*)$/i
  ];

  for (const pattern of namePatterns) {
    const match = message.match(pattern);
    if (match) {
      name = match[1];
      break;
    }
  }

  // Si encontramos email o teléfono, es un lead
  const isLead = (emails && emails.length > 0) || (phones && phones.length > 0);

  return {
    isLead,
    info: {
      name: name || 'No proporcionado',
      email: emails ? emails[0] : '',
      phone: phones ? phones[0] : '',
      timestamp: new Date().toISOString()
    }
  };
}

// Enviar notificación de lead por email usando Resend
async function sendLeadNotification(leadInfo, lastMessage, conversationHistory) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurada, omitiendo email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const conversationSummary = conversationHistory
    .filter(msg => msg.role === 'user')
    .map((msg, i) => `${i + 1}. ${msg.parts[0].text}`)
    .join('\n');

  // Importar la funcion send-email internamente
  const response = await fetch(`https://${process.env.URL || 'marianoaliandri.com.ar'}/.netlify/functions/send-email`, {
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

  if (!response.ok) {
    throw new Error(`Error enviando email: ${response.status}`);
  }

  return response;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: responseHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { message, conversationHistory = [] } = JSON.parse(event.body);

    if (!message) {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY no está configurada');
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({
          error: 'API key no configurada',
          response: 'El chatbot no está disponible temporalmente. Por favor, contactame por WhatsApp al +54 299 541-4422 o por email a marianoaliandri@gmail.com'
        })
      };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 800,
      }
    });

    // Construir historial en formato correcto
    let history = [
      { role: "user", parts: [{ text: MARIANO_CONTEXT }] },
      { role: "model", parts: [{ text: "Comprendido. Soy el asistente virtual de Mariano Aliandri." }] }
    ];

    // Agregar historial de conversación si existe
    if (conversationHistory && conversationHistory.length > 0) {
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role,
        parts: msg.parts
      }));
      history = [...history, ...formattedHistory];
    }

    const chat = model.startChat({ history });

    const result = await chat.sendMessage(message);
    const response = await result.response.text();

    // Detectar si el mensaje del usuario contiene información de contacto
    const leadDetected = detectLeadInfo(message, conversationHistory);

    // Si detectamos un lead, enviar notificación por email
    if (leadDetected.isLead) {
      try {
        await sendLeadNotification(leadDetected.info, message, conversationHistory);
        console.log('✅ Lead capturado y email enviado:', leadDetected.info);
      } catch (emailError) {
        console.error('❌ Error enviando email de lead:', emailError);
        // No fallar la respuesta del chat por error en email
      }
    }

    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        success: true,
        response: response,
        leadCaptured: leadDetected.isLead
      })
    };

  } catch (error) {
    console.error('❌ Error en chat function:', error);
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        error: 'Error al procesar el mensaje',
        response: 'Disculpá, estoy teniendo un problema de conexión. Por favor, contactame por WhatsApp al +54 299 541-4422 o por email a marianoaliandri@gmail.com',
        details: error.message
      })
    };
  }
}
