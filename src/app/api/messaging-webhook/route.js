export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import admin, { getDb } from '@/lib/firebase-admin';
const db = getDb();
import { GoogleGenerativeAI } from '@google/generative-ai';

const MARIANO_CONTEXT_BASE = `Sos el asistente comercial profesional de Mariano Aliandri. Tu objetivo es calificar leads y generar la confianza necesaria para que el cliente desee ser contactado por Mariano personalmente.

TU PERSONALIDAD PROFESIONAL:
- Consultor Experto: No solo respondés preguntas, entendés el problema de fondo del cliente.
- Empatía Empresarial: Comprendés que contratar servicios de desarrollo o análisis de datos es una inversión importante.
- Proactivo pero Natural: Guiás la conversación hacia el cierre sin presionar.
- Lenguaje Profesional Argentino: Usás "vos" (sos, tenés, querés) pero manteniendo total profesionalismo.

SERVICIOS DE MARIANO:
DESARROLLO WEB & APLICACIONES: Sitios web corporativos modernos (React, Next.js), Aplicaciones web personalizadas, E-commerce, Automatización de procesos.
ANÁLISIS DE DATOS & BI: Dashboards ejecutivos en Power BI, Reportes automatizados y KPIs, Análisis predictivo y forecasting.
PYTHON & AUTOMATIZACIÓN: Web scraping, Automatización de procesos, Scripts de análisis de datos, Integración de APIs.
CONSULTORÍA: Auditoría de procesos, Diseño de arquitectura, Definición de KPIs, Capacitación de equipos.

ESTRATEGIA:
1. APERTURA: Entendé la necesidad del cliente
2. CUALIFICACIÓN: Conectá su necesidad con la solución de Mariano
3. CIERRE: Cuando hay interés, pedí nombre, email y WhatsApp para consulta gratuita`;

const CHANNEL_CONTEXTS = {
  instagram: `${MARIANO_CONTEXT_BASE}\n\nFORMATO INSTAGRAM:\n- Respuestas CORTAS (máx 700 caracteres)\n- Usa emojis estratégicamente 💡 📊 🚀\n- Prioriza captura de contacto`,
  messenger: `${MARIANO_CONTEXT_BASE}\n\nFORMATO FACEBOOK MESSENGER:\n- Respuestas conversacionales y amigables\n- Usa emojis moderadamente 😊 💼 ✅`,
  whatsapp: `${MARIANO_CONTEXT_BASE}\n\nFORMATO WHATSAPP:\n- Respuestas profesionales pero cercanas\n- Aprovecha formato: *negritas*, _cursivas_\n- WhatsApp es el canal más directo, aprovecha para cerrar leads`,
};

function validateSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch { return false; }
}

async function sendMessage(channel, recipientId, message, accessToken) {
  let url, payload;
  const maxLength = channel === 'whatsapp' ? 4000 : 800;
  const messages = message.length > maxLength ? splitMessage(message, maxLength) : [message];

  for (const msg of messages) {
    switch (channel) {
      case 'instagram':
        url = 'https://graph.instagram.com/v21.0/me/messages';
        payload = { recipient: { id: recipientId }, message: { text: msg } };
        break;
      case 'messenger':
        url = 'https://graph.facebook.com/v21.0/me/messages';
        payload = { recipient: { id: recipientId }, message: { text: msg } };
        break;
      case 'whatsapp':
        url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        payload = { messaging_product: 'whatsapp', to: recipientId, type: 'text', text: { body: msg } };
        break;
    }
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`${channel} API Error: ${error.error?.message || 'Unknown'}`);
    }
    if (messages.length > 1) await new Promise(resolve => setTimeout(resolve, 500));
  }
}

function splitMessage(text, maxLength) {
  const messages = [];
  let currentMsg = '';
  for (const line of text.split('\n')) {
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

async function getConversationHistory(userId, channel) {
  try {
    const snapshot = await db.collection('conversations').doc(`${channel}_${userId}`).collection('messages').orderBy('timestamp', 'desc').limit(10).get();
    const messages = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      messages.push({ role: data.isBot ? 'assistant' : 'user', content: data.text });
    });
    return messages.reverse();
  } catch { return []; }
}

async function saveMessage(userId, channel, username, text, isBot) {
  try {
    const conversationId = `${channel}_${userId}`;
    await db.collection('conversations').doc(conversationId).collection('messages').add({ text, isBot, channel, timestamp: admin.firestore.FieldValue.serverTimestamp(), username });
    await db.collection('conversations').doc(conversationId).set({ userId, channel, username, lastMessageAt: admin.firestore.FieldValue.serverTimestamp(), lastMessage: text.substring(0, 100) }, { merge: true });
  } catch { /* ignore */ }
}

function detectLead(message) {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const phoneRegex = /(\+?54\s?9?\s?)?(\d{2,4}[\s-]?\d{6,8}|\d{10,})/g;
  const email = message.match(emailRegex)?.[0] || null;
  const phone = message.match(phoneRegex)?.[0] || null;
  const intentPatterns = [/quiero.*contacto/i, /c[oó]mo.*comunic/i, /necesito.*presupuesto/i, /me.*interesa/i, /coordin.*llamada/i, /hablamos/i, /agendar/i];
  const hasIntent = intentPatterns.some(p => p.test(message));
  return { isLead: !!(email || phone || hasIntent), email, phone, hasIntent };
}

async function saveLead(userId, channel, username, leadData, conversationHistory) {
  try {
    await db.collection('leads').add({
      userId, channel, username, email: leadData.email, phone: leadData.phone,
      capturedAt: admin.firestore.FieldValue.serverTimestamp(), leadSource: `${channel}_dm`, status: 'new',
      conversationHistory: conversationHistory.slice(-5).map(msg => ({ role: msg.role, text: msg.content })),
    });
  } catch { /* ignore */ }
}

async function processWithGemini(userMessage, history, channel) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', systemInstruction: CHANNEL_CONTEXTS[channel] });
    const geminiHistory = history.map(msg => ({ role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text: msg.content }] }));
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch {
    const fallbacks = {
      instagram: '¡Hola! 👋 Gracias por contactarte. Escribile a Mariano por WhatsApp: +54 299 541 4422 🚀',
      messenger: '¡Hola! 😊 Por favor escribile a Mariano por WhatsApp al +54 299 541 4422.',
      whatsapp: '¡Hola! 👋 Mariano te va a responder personalmente en breve.',
    };
    return fallbacks[channel] || fallbacks.instagram;
  }
}

async function processMessageAsync(userId, channel, username, messageText, accessToken) {
  try {
    await saveMessage(userId, channel, username, messageText, false);
    const history = await getConversationHistory(userId, channel);
    const leadInfo = detectLead(messageText);
    const aiResponse = await processWithGemini(messageText, history, channel);
    await saveMessage(userId, channel, username, aiResponse, true);
    await sendMessage(channel, userId, aiResponse, accessToken);
    if (leadInfo.isLead) await saveLead(userId, channel, username, leadInfo, history);
  } catch (error) {
    try {
      const fallbackMsg = channel === 'whatsapp' ? '¡Hola! 👋 Mariano te responde en breve.' : `¡Hola! 👋 Escribile a Mariano por WhatsApp: +54 299 541 4422`;
      await sendMessage(channel, userId, fallbackMsg, accessToken);
    } catch { /* ignore */ }
  }
}

async function parseInstagramWebhook(data) {
  const messages = [];
  for (const entry of data.entry || []) {
    for (const messaging of entry.messaging || []) {
      if (messaging.message?.text) {
        messages.push({ channel: 'instagram', userId: messaging.sender.id, username: messaging.sender.username || `ig_${messaging.sender.id.substring(0, 8)}`, text: messaging.message.text, accessToken: process.env.INSTAGRAM_PAGE_ACCESS_TOKEN });
      }
    }
  }
  return messages;
}

function parseMessengerWebhook(data) {
  const messages = [];
  for (const entry of data.entry || []) {
    for (const messaging of entry.messaging || []) {
      if (messaging.message?.text) {
        messages.push({ channel: 'messenger', userId: messaging.sender.id, username: `fb_${messaging.sender.id.substring(0, 8)}`, text: messaging.message.text, accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN });
      }
    }
  }
  return messages;
}

function parseWhatsAppWebhook(data) {
  const messages = [];
  for (const entry of data.entry || []) {
    for (const change of entry.changes || []) {
      if (change.value?.messages) {
        for (const message of change.value.messages) {
          if (message.type === 'text') {
            messages.push({ channel: 'whatsapp', userId: message.from, username: change.value.contacts?.[0]?.profile?.name || `wa_${message.from.substring(0, 8)}`, text: message.text.body, accessToken: process.env.WHATSAPP_ACCESS_TOKEN || process.env.INSTAGRAM_PAGE_ACCESS_TOKEN });
          }
        }
      }
    }
  }
  return messages;
}

// GET: Meta webhook verification
export async function GET(request) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return Response.json({ error: 'Verification failed' }, { status: 403 });
}

// POST: Receive messages
export async function POST(request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || request.headers.get('X-Hub-Signature-256');
    const appSecret = process.env.META_APP_SECRET || process.env.INSTAGRAM_APP_SECRET;

    let isValidSignature = false;
    try { isValidSignature = validateSignature(rawBody, signature, appSecret); } catch { /* ignore */ }

    if (!signature || !isValidSignature) {
      return Response.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const data = JSON.parse(rawBody);
    let messages = [];

    if (data.object === 'instagram') messages = await parseInstagramWebhook(data);
    else if (data.object === 'page') messages = parseMessengerWebhook(data);
    else if (data.object === 'whatsapp_business_account') messages = parseWhatsAppWebhook(data);

    for (const msg of messages) {
      processMessageAsync(msg.userId, msg.channel, msg.username, msg.text, msg.accessToken).catch(console.error);
    }

    return Response.json({ status: 'EVENT_RECEIVED' });
  } catch (error) {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
