// netlify/functions/messaging-webhook.js
// Webhook UNIFICADO para Instagram, Facebook Messenger y WhatsApp
// Usa Gemini AI para respuestas inteligentes
// Updated: 2025-12-17 - Instagram linked to Facebook Page
import crypto from 'crypto';
import admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Inicializar Firebase Admin (solo una vez)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

// Contexto base de Mariano (compartido entre todos los canales)
const MARIANO_CONTEXT_BASE = `Sos el asistente comercial profesional de Mariano Aliandri. Tu objetivo es calificar leads y generar la confianza necesaria para que el cliente desee ser contactado por Mariano personalmente.

TU PERSONALIDAD PROFESIONAL:
- Consultor Experto: No solo respondés preguntas, entendés el problema de fondo del cliente.
- Empatía Empresarial: Comprendés que contratar servicios de desarrollo o análisis de datos es una inversión importante.
- Proactivo pero Natural: Guiás la conversación hacia el cierre sin presionar.
- Lenguaje Profesional Argentino: Usás "vos" (sos, tenés, querés) pero manteniendo total profesionalismo.

SERVICIOS DE MARIANO:

DESARROLLO WEB & APLICACIONES:
- Sitios web corporativos modernos (React, Next.js)
- Aplicaciones web personalizadas
- E-commerce y plataformas de venta online
- Automatización de procesos con web apps
- Stack: React, Next.js, Node.js, TypeScript

ANÁLISIS DE DATOS & BI:
- Dashboards ejecutivos en Power BI
- Reportes automatizados y KPIs
- Análisis predictivo y forecasting
- Consultoría en Business Intelligence
- Excel avanzado con Power Query y Power Pivot

PYTHON & AUTOMATIZACIÓN:
- Web scraping para recolección de datos
- Automatización de procesos repetitivos
- Scripts de análisis de datos
- Integración de APIs
- ETL y procesamiento de datos

CONSULTORÍA:
- Auditoría de procesos y datos actuales
- Diseño de arquitectura de soluciones
- Definición de KPIs y métricas
- Capacitación de equipos

ESTRATEGIA:
1. APERTURA: Entendé la necesidad del cliente
2. CUALIFICACIÓN: Conectá su necesidad con la solución de Mariano
3. CIERRE: Cuando hay interés, pedí nombre, email y WhatsApp para consulta gratuita`;

// Contextos específicos por canal
const CHANNEL_CONTEXTS = {
  instagram: `${MARIANO_CONTEXT_BASE}

FORMATO INSTAGRAM:
- Respuestas CORTAS (máx 700 caracteres)
- Usa emojis estratégicamente 💡 📊 🚀
- Si necesitas explicar mucho, ofrece seguir por WhatsApp
- Respuestas rápidas: usa bullets en vez de párrafos
- Prioriza captura de contacto sobre explicaciones largas

CIERRE: "¡Excelente! 🙌 Para que Mariano prepare la mejor propuesta, necesito:
• Nombre
• Email
• WhatsApp

Te contacta en 24hs! 📱"`,

  messenger: `${MARIANO_CONTEXT_BASE}

FORMATO FACEBOOK MESSENGER:
- Respuestas conversacionales y amigables
- Usa emojis moderadamente 😊 💼 ✅
- Messenger permite mensajes más largos
- Usa saltos de línea para organizar información

CIERRE: "¡Perfecto! 😊 Para coordinar una consulta inicial gratuita, necesito:

📝 Nombre completo
📧 Email
📱 Teléfono/WhatsApp

Mariano se comunica en 24hs. ¿Te parece?"`,

  whatsapp: `${MARIANO_CONTEXT_BASE}

FORMATO WHATSAPP:
- Respuestas profesionales pero cercanas
- Usa emojis de WhatsApp 👋 ✅ 📊 💡
- Aprovecha formato: *negritas*, _cursivas_
- WhatsApp es el canal más directo, aprovecha para cerrar leads

CIERRE: "¡Excelente! ✅

Para que Mariano te prepare una *propuesta personalizada*, confirmame:

📝 *Nombre completo*
📧 *Email*
💼 *Empresa* (opcional)

Mariano se comunica en 24hs para consulta gratuita de 30 min. ¿Dale?"`
};

// Obtener mensaje de Instagram usando Graph API (workaround para message_edit)
async function fetchInstagramMessage(messageId, accessToken) {
  try {
    const url = `https://graph.instagram.com/v21.0/${messageId}?fields=id,text,from&access_token=${accessToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error('[Graph API Error]', {
        status: response.status,
        statusText: response.statusText
      });
      return null;
    }

    const data = await response.json();
    console.log('[Graph API Success]', {
      messageId: data.id,
      hasText: !!data.text,
      from: data.from?.id
    });

    return data;
  } catch (error) {
    console.error('[Graph API Fetch Error]', error.message);
    return null;
  }
}

// Validar firma HMAC de Meta
function validateSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// Enviar mensaje según el canal
async function sendMessage(channel, recipientId, message, accessToken) {
  let url, payload;

  switch (channel) {
    case 'instagram':
      url = 'https://graph.instagram.com/v21.0/me/messages';
      payload = {
        recipient: { id: recipientId },
        message: { text: message }
      };
      break;

    case 'messenger':
      url = 'https://graph.facebook.com/v21.0/me/messages';
      payload = {
        recipient: { id: recipientId },
        message: { text: message }
      };
      break;

    case 'whatsapp':
      url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      payload = {
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'text',
        text: { body: message }
      };
      break;

    default:
      throw new Error(`Unknown channel: ${channel}`);
  }

  // Split de mensajes largos (excepto WhatsApp que soporta 4096 caracteres)
  const maxLength = channel === 'whatsapp' ? 4000 : 800;
  const messages = message.length > maxLength ? splitMessage(message, maxLength) : [message];

  for (const msg of messages) {
    try {
      // Actualizar payload con mensaje actual
      if (channel === 'whatsapp') {
        payload.text.body = msg;
      } else {
        payload.message.text = msg;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`[${channel.toUpperCase()} Send Error]`, error);
        throw new Error(`${channel} API Error: ${error.error?.message || 'Unknown'}`);
      }

      // Pequeña pausa entre mensajes múltiples
      if (messages.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`[${channel.toUpperCase()} Send Failed]`, error);
      throw error;
    }
  }
}

// Split de mensajes largos
function splitMessage(text, maxLength) {
  const messages = [];
  let currentMsg = '';

  const lines = text.split('\n');

  for (const line of lines) {
    if ((currentMsg + line + '\n').length > maxLength) {
      if (currentMsg) messages.push(currentMsg.trim());
      currentMsg = line + '\n';
    } else {
      currentMsg += line + '\n';
    }
  }

  if (currentMsg) messages.push(currentMsg.trim());

  return messages.length > 0 ? messages : [text.substring(0, maxLength)];
}

// Cargar historial de conversación
async function getConversationHistory(userId, channel) {
  try {
    const messagesRef = db
      .collection('conversations')
      .doc(`${channel}_${userId}`)
      .collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(10);

    const snapshot = await messagesRef.get();
    const messages = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      messages.push({
        role: data.isBot ? 'assistant' : 'user',
        content: data.text
      });
    });

    return messages.reverse(); // Oldest first para Llama
  } catch (error) {
    console.error('[Firestore History Error]', error);
    return [];
  }
}

// Guardar mensaje en Firestore
async function saveMessage(userId, channel, username, text, isBot) {
  try {
    const conversationId = `${channel}_${userId}`;

    await db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .add({
        text,
        isBot,
        channel,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        username
      });

    // Actualizar metadata de conversación
    await db.collection('conversations').doc(conversationId).set({
      userId,
      channel,
      username,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessage: text.substring(0, 100)
    }, { merge: true });
  } catch (error) {
    console.error('[Firestore Save Error]', error);
  }
}

// Detectar lead
function detectLead(message) {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const phoneRegex = /(\+?54\s?9?\s?)?(\d{2,4}[\s-]?\d{6,8}|\d{10,})/g;

  const email = message.match(emailRegex)?.[0] || null;
  const phone = message.match(phoneRegex)?.[0] || null;

  // Detectar intención de contacto
  const intentPatterns = [
    /quiero.*contacto/i,
    /c[oó]mo.*comunic/i,
    /necesito.*presupuesto/i,
    /me.*interesa/i,
    /coordin.*llamada/i,
    /hablamos/i,
    /agendar/i
  ];

  const hasIntent = intentPatterns.some(p => p.test(message));

  return {
    isLead: !!(email || phone || hasIntent),
    email,
    phone,
    hasIntent
  };
}

// Guardar lead
async function saveLead(userId, channel, username, leadData, conversationHistory) {
  try {
    await db.collection('leads').add({
      userId,
      channel,
      username,
      email: leadData.email,
      phone: leadData.phone,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(),
      leadSource: `${channel}_dm`,
      status: 'new',
      conversationHistory: conversationHistory.slice(-5).map(msg => ({
        role: msg.role,
        text: msg.content
      }))
    });

    console.log('[Lead Captured]', { channel, userId, username, email: leadData.email });
  } catch (error) {
    console.error('[Lead Save Error]', error);
  }
}

// Procesar mensaje con Gemini AI
async function processWithGemini(userMessage, history, channel) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: CHANNEL_CONTEXTS[channel]
    });

    // Convertir historial a formato Gemini
    const geminiHistory = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(userMessage);

    return result.response.text();

  } catch (error) {
    console.error('[Gemini AI Error]', error);

    // Fallback personalizado por canal
    const fallbacks = {
      instagram: '¡Hola! 👋 Gracias por contactarte. Estoy teniendo problemas técnicos. Escribile a Mariano por WhatsApp: +54 299 541 4422 🚀',
      messenger: '¡Hola! 😊 Gracias por contactarte. Estoy teniendo un problema técnico temporal. Por favor escribile a Mariano por WhatsApp al +54 299 541 4422 para una respuesta inmediata. ¡Gracias!',
      whatsapp: '¡Hola! 👋 Tengo un problema técnico temporal. Mariano te va a responder personalmente en breve. ¡Gracias por la paciencia!'
    };

    return fallbacks[channel] || fallbacks.instagram;
  }
}

// Procesar mensaje asíncronamente
async function processMessageAsync(userId, channel, username, messageText, accessToken) {
  try {
    // Guardar mensaje del usuario
    await saveMessage(userId, channel, username, messageText, false);

    // Cargar historial
    const history = await getConversationHistory(userId, channel);

    // Detectar lead
    const leadInfo = detectLead(messageText);

    // Procesar con Gemini AI
    const aiResponse = await processWithGemini(messageText, history, channel);

    // Guardar respuesta del bot
    await saveMessage(userId, channel, username, aiResponse, true);

    // Enviar respuesta según canal
    await sendMessage(channel, userId, aiResponse, accessToken);

    // Si es lead, guardar
    if (leadInfo.isLead) {
      await saveLead(userId, channel, username, leadInfo, history);
    }

    console.log('[Message Processed]', { channel, userId, username, isLead: leadInfo.isLead });
  } catch (error) {
    console.error('[Process Error]', error);

    // Mensaje de fallback
    try {
      const fallbackMsg = channel === 'whatsapp'
        ? '¡Hola! 👋 Mariano te responde en breve.'
        : `¡Hola! 👋 Escribile a Mariano por WhatsApp: +54 299 541 4422`;

      await sendMessage(channel, userId, fallbackMsg, accessToken);
    } catch (sendError) {
      console.error('[Fallback Send Error]', sendError);
    }
  }
}

// Parsear webhook de Instagram
async function parseInstagramWebhook(data) {
  const messages = [];

  for (const entry of data.entry || []) {
    for (const messaging of entry.messaging || []) {
      // Mensaje normal con texto
      if (messaging.message && messaging.message.text) {
        messages.push({
          channel: 'instagram',
          userId: messaging.sender.id,
          username: messaging.sender.username || `ig_${messaging.sender.id.substring(0, 8)}`,
          text: messaging.message.text,
          messageId: messaging.message.mid,
          accessToken: process.env.INSTAGRAM_PAGE_ACCESS_TOKEN
        });
      }
      // Workaround: message_edit con num_edit=0 indica mensaje nuevo
      // Usamos Graph API para obtener el texto del mensaje
      else if (messaging.message_edit && messaging.message_edit.num_edit === 0) {
        console.log('[Instagram message_edit detected - fetching content via Graph API]', {
          mid: messaging.message_edit.mid,
          sender: messaging.sender?.id
        });

        const messageData = await fetchInstagramMessage(
          messaging.message_edit.mid,
          process.env.INSTAGRAM_PAGE_ACCESS_TOKEN
        );

        if (messageData && messageData.text) {
          messages.push({
            channel: 'instagram',
            userId: messageData.from?.id || messaging.sender?.id,
            username: messageData.from?.username || `ig_${(messageData.from?.id || messaging.sender?.id || '').substring(0, 8)}`,
            text: messageData.text,
            messageId: messageData.id,
            accessToken: process.env.INSTAGRAM_PAGE_ACCESS_TOKEN
          });
        } else {
          console.error('[Instagram message_edit] Could not fetch message text');
        }
      }
    }
  }

  return messages;
}

// Parsear webhook de Facebook Messenger
function parseMessengerWebhook(data) {
  const messages = [];

  for (const entry of data.entry || []) {
    for (const messaging of entry.messaging || []) {
      if (messaging.message && messaging.message.text) {
        messages.push({
          channel: 'messenger',
          userId: messaging.sender.id,
          username: `fb_${messaging.sender.id.substring(0, 8)}`,
          text: messaging.message.text,
          accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN
        });
      }
    }
  }

  return messages;
}

// Parsear webhook de WhatsApp
function parseWhatsAppWebhook(data) {
  const messages = [];

  for (const entry of data.entry || []) {
    for (const change of entry.changes || []) {
      if (change.value && change.value.messages) {
        for (const message of change.value.messages) {
          if (message.type === 'text') {
            messages.push({
              channel: 'whatsapp',
              userId: message.from,
              username: change.value.contacts?.[0]?.profile?.name || `wa_${message.from.substring(0, 8)}`,
              text: message.text.body,
              accessToken: process.env.WHATSAPP_ACCESS_TOKEN || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN
            });
          }
        }
      }
    }
  }

  return messages;
}

// Handler principal
export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Hub-Signature-256',
    'Content-Type': 'application/json'
  };

  // OPTIONS request (CORS)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET: Verificación de webhook de Meta
  if (event.httpMethod === 'GET') {
    const mode = event.queryStringParameters?.['hub.mode'];
    const token = event.queryStringParameters?.['hub.verify_token'];
    const challenge = event.queryStringParameters?.['hub.challenge'];

    console.log('[Webhook Verification]', { mode, token: token?.substring(0, 10) });

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      console.log('[Webhook Verified] ✅');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain' },
        body: challenge
      };
    }

    console.error('[Webhook Verification Failed] ❌');
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Verification failed' }) };
  }

  // POST: Recibir mensajes
  if (event.httpMethod === 'POST') {
    try {
      console.log('[POST Request Received]', {
        hasBody: !!event.body,
        bodyLength: event.body?.length,
        headers: Object.keys(event.headers)
      });

      // Validar firma HMAC
      const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];
      const appSecret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;

      console.log('[Signature Validation]', {
        hasSignature: !!signature,
        hasAppSecret: !!appSecret,
        signaturePreview: signature?.substring(0, 30)
      });

      let isValidSignature = false;
      try {
        isValidSignature = validateSignature(event.body, signature, appSecret);
        console.log('[Signature Result]', { isValid: isValidSignature });
      } catch (error) {
        console.error('[Signature Validation Error]', error.message);
      }

      if (!signature || !isValidSignature) {
        console.error('[Invalid Signature] ❌', {
          hasSignature: !!signature,
          isValid: isValidSignature
        });
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Invalid signature' }) };
      }

      const data = JSON.parse(event.body);
      console.log('[Webhook Data]', {
        object: data.object,
        entryCount: data.entry?.length,
        fullData: JSON.stringify(data, null, 2)
      });

      // Identificar tipo de webhook y parsear mensajes
      let messages = [];

      if (data.object === 'instagram') {
        messages = await parseInstagramWebhook(data);
      } else if (data.object === 'page') {
        messages = parseMessengerWebhook(data);
      } else if (data.object === 'whatsapp_business_account') {
        messages = parseWhatsAppWebhook(data);
      }

      // Procesar cada mensaje asíncronamente
      for (const msg of messages) {
        console.log('[Message Received]', {
          channel: msg.channel,
          userId: msg.userId,
          username: msg.username,
          messageLength: msg.text.length
        });

        processMessageAsync(msg.userId, msg.channel, msg.username, msg.text, msg.accessToken)
          .catch(err => console.error('[Async Process Error]', err));
      }

      // Responder inmediatamente a Meta (requerido)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'EVENT_RECEIVED' })
      };

    } catch (error) {
      console.error('[Webhook Error]', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Internal error' })
      };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
