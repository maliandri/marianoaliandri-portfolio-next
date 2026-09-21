// Bot de noticias — corre en GitHub Actions, no en Vercel. Autocontenido a
// propósito: no importa nada de src/ (esos archivos son CommonJS por default
// en este package.json, y usan sintaxis ESM — un `node` plano no puede
// importarlos desde un script externo al build de Next).
import admin from 'firebase-admin';
import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Groq deprecó llama-3.3-70b-versatile para free/developer tier el 2026-06-17.
// openai/gpt-oss-120b es el reemplazo recomendado por Groq con perfil de cuota
// gratis similar (1.000 req/día). Verificado en vivo tras el 404 del modelo viejo.
const GROQ_MODEL = 'openai/gpt-oss-120b';
const SITE_URL = 'https://marianoaliandri.com.ar';
const MAX_ITEM_AGE_MS = 48 * 60 * 60 * 1000; // 48 horas — el bot corre cada hora, no tiene sentido publicar algo más viejo
const MAX_ITEMS_PER_RUN = 5;
// Sin este tope, un tópico con mucho volumen de RSS (ej. "inteligencia artificial",
// 80-90 items por corrida) agota todo MAX_ITEMS_PER_RUN antes de que el loop llegue
// a los demás tópicos activos — en la práctica el bot terminaba publicando SIEMPRE
// del mismo tópico. Esto obliga a rotar entre todos los tópicos activos cada corrida.
const MAX_ITEMS_PER_TOPIC = 2;

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return url.trim().toLowerCase();
  }
}

function hashUrl(url) {
  return crypto.createHash('sha256').update(normalizeUrl(url)).digest('hex').slice(0, 16);
}

// Argentina es UTC-3 todo el año (sin horario de verano).
function startOfTodayArgentina() {
  const now = new Date();
  const arOffsetMs = 3 * 60 * 60 * 1000;
  const arNow = new Date(now.getTime() - arOffsetMs);
  const startAR = Date.UTC(arNow.getUTCFullYear(), arNow.getUTCMonth(), arNow.getUTCDate());
  return new Date(startAR + arOffsetMs);
}

// Devuelve un Date cuyos getters UTC (getUTCDay, getUTCHours) leen como hora de pared
// en Argentina — mismo truco de offset que startOfTodayArgentina().
export function nowArgentina(date = new Date()) {
  const arOffsetMs = 3 * 60 * 60 * 1000;
  return new Date(date.getTime() - arOffsetMs);
}

const SCHEDULE_DAY_KEYS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab']; // getUTCDay(): 0=domingo

// Función pura: dado el schedule configurado (o null) y el momento actual ya ajustado a
// hora Argentina (nowArgentina()), decide si el bot puede publicar ahora.
export function isWithinSchedule(schedule, arNow) {
  if (!schedule) return true;
  const day = schedule[SCHEDULE_DAY_KEYS[arNow.getUTCDay()]];
  if (!day || !day.enabled) return false;
  if (day.startHour == null || day.endHour == null) return true;
  const hour = arNow.getUTCHours();
  return hour >= day.startHour && hour < day.endHour;
}

async function fetchConfig(db) {
  const doc = await db.collection('noticias_config').doc('settings').get();
  const data = doc.data() || {};
  return { active: data.active !== false, dailyCap: data.dailyCap ?? null, schedule: data.schedule ?? null };
}

async function fetchActiveTopics(db) {
  const snap = await db.collection('noticias_topics').where('activo', '==', true).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Trae docs de hoy por rango de fecha (un solo campo, sin índice compuesto) y
// filtra por status en memoria.
async function countPublishedToday(db) {
  const cutoff = startOfTodayArgentina();
  const snap = await db.collection('noticias').where('publishedAt', '>=', cutoff).get();
  return snap.docs.filter(d => d.data().status === 'published').length;
}

async function alreadyPublished(db, sourceUrlHash) {
  const snap = await db.collection('noticias').where('sourceUrlHash', '==', sourceUrlHash).limit(1).get();
  return !snap.empty;
}

async function fetchGoogleNewsRss(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=AR&ceid=AR:es-419`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Google News RSS ${resp.status}`);
  const xml = await resp.text();
  const parsed = new XMLParser().parse(xml);
  const rawItems = parsed?.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);
  const now = Date.now();
  return items
    .map(it => ({ title: String(it.title || '').trim(), link: String(it.link || '').trim(), pubDate: it.pubDate || null }))
    .filter(it => it.title && it.link)
    .filter(it => {
      const t = it.pubDate ? Date.parse(it.pubDate) : NaN;
      return !Number.isNaN(t) && (now - t) < MAX_ITEM_AGE_MS;
    })
    // Google News RSS /search viene ordenado por relevancia, no por fecha — se ordena acá.
    .sort((a, b) => Date.parse(a.pubDate) - Date.parse(b.pubDate));
}

function buildPrompt(item, topic) {
  return `Sos el redactor del canal de noticias de Mariano Aliandri (${SITE_URL}), desarrollador Full Stack y analista de datos de Neuquén, Argentina.

Tenés este titular real como disparador:
Título: ${item.title}
Fuente: ${item.link}
Tópico que seguís: ${topic.label}

Escribí, en español rioplatense (vos, no tú), un JSON con exactamente estas 3 claves, sin texto extra antes ni después ni bloques de código:
{"title": "título propio para la nota, no copies el original tal cual", "body": "2 a 4 párrafos (separados por \\n) explicando la noticia y por qué importa, tono cercano y profesional, sin inventar datos que no estén en el titular", "caption": "1 a 2 oraciones cortas para un post de red social, SIN incluir ningún link ni URL"}

IMPORTANTE sobre "body": tiene que contar la noticia COMPLETA — qué pasó, quién, cuándo,
por qué importa. Nada de escribir un gancho vacío tipo "te contamos los detalles" o
"enterate qué pasó" que obligue a entrar al link para saber de qué se trata. El link a la
nota completa se agrega aparte, después del body, como algo opcional para quien quiera
profundizar — no como la única forma de enterarse. Lo mismo aplica a "caption": tiene que
resumir la noticia en sí, no ser un cliffhanger.` +
    (topic.toneInstructions && topic.toneInstructions.trim()
      ? `\n\nTONO ESPECÍFICO PARA ESTE TÓPICO (seguilo estrictamente, tiene prioridad sobre el tono por default de arriba):\n${topic.toneInstructions.trim()}`
      : '');
}

function parseAndValidateContent(rawText, providerLabel) {
  if (!rawText) throw new Error(`${providerLabel} no generó texto (posible bloqueo de contenido)`);

  const clean = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`${providerLabel} no devolvió JSON válido`);
  }
  if (!parsed.title || !parsed.body || !parsed.caption) throw new Error(`JSON de ${providerLabel} incompleto (falta title, body o caption)`);
  if (parsed.caption.length > 2000) throw new Error(`Caption de ${providerLabel} demasiado larga (posible alucinación)`);
  if (/https?:\/\/|www\./i.test(parsed.caption)) throw new Error(`Caption de ${providerLabel} incluye un link — se descarta (rompe el requisito de post sin preview card)`);
  return parsed;
}

async function generateContentGemini(item, topic) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const prompt = buildPrompt(item, topic);
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await resp.json();
  if (!resp.ok || data?.error) throw new Error(`Gemini ${resp.status}: ${data?.error?.message || 'error desconocido'}`);

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  return parseAndValidateContent(text, 'Gemini');
}

// Fallback cuando falla Gemini (cuota compartida con el resto del sitio, ver comentario
// en main()). Groq tiene free tier sin tarjeta y sin relación con la cuota de Google.
async function generateContentGroq(item, topic) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY no configurada');

  const prompt = buildPrompt(item, topic);
  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });
  const data = await resp.json();
  if (!resp.ok || data?.error) throw new Error(`Groq ${resp.status}: ${data?.error?.message || 'error desconocido'}`);

  const text = data?.choices?.[0]?.message?.content?.trim();
  return parseAndValidateContent(text, 'Groq');
}

async function generateContent(item, topic) {
  try {
    const content = await generateContentGemini(item, topic);
    return { ...content, provider: 'gemini' };
  } catch (e) {
    if (!process.env.GROQ_API_KEY) throw e;
    console.warn(`  Gemini falló ("${e.message}"), reintentando con Groq...`);
    const content = await generateContentGroq(item, topic);
    return { ...content, provider: 'groq' };
  }
}

// Mismo patrón que src/app/api/auditorias/send-biz-email/route.js — duplicado
// acá porque este script no puede importar de src/ (ver nota al principio del
// archivo).
//
// Nota: a diferencia del route.js original (que agrega `&embed=screenshot.url`),
// acá se omite ese parámetro a propósito. `embed=<campo>` le pide a Microlink
// que devuelva el binario de la imagen directo (content-type: image/png) en
// vez del JSON — con `embed` puesto, `resp.json()` siempre tira (parseo de
// PNG como JSON) y esta función termina devolviendo `null` siempre, sea cual
// sea la URL. Verificado en vivo contra la API real. Sin `embed`, la API
// devuelve JSON normal con `data.screenshot.url` (un link público a
// iad.microlink.io), que es justamente lo que esta función necesita devolver.
async function getScreenshot(url) {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    const data = await resp.json();
    return data?.data?.screenshot?.url || null;
  } catch {
    return null;
  }
}

// Fallback liviano cuando getScreenshot() falla: en vez de renderizar la
// página entera (lento, y muchos sitios de noticias bloquean o tardan),
// esto solo lee el <meta og:image> del artículo — casi todos los medios ya
// la tienen para sus propias previews de WhatsApp/Facebook.
async function getMetaImage(url) {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false&meta=true`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    const data = await resp.json();
    return data?.data?.image?.url || null;
  } catch {
    return null;
  }
}

async function getImageUrl(url) {
  return (await getScreenshot(url)) || (await getMetaImage(url));
}

async function uploadToCloudinary(imageUrl) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error('CLOUDINARY_CLOUD_NAME o CLOUDINARY_UPLOAD_PRESET no configurados');

  const form = new URLSearchParams();
  form.set('file', imageUrl);
  form.set('upload_preset', uploadPreset);

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error?.message || `Cloudinary ${resp.status}`);
  return data.secure_url;
}

// Instagram rechaza por URL formatos como WebP (error 9007 "Media ID is not
// available", que además apaga el escenario de Make y acumula la cola) y
// proporciones fuera de 4:5–1.91:1. Cloudinary conserva el formato original al
// subir, así que pedimos la versión JPG 1080x1080 solo para lo que va a Make;
// el `imageUrl` guardado en Firestore para el sitio queda intacto.
export function toInstagramSafeUrl(url) {
  return url.replace('/image/upload/', '/image/upload/c_fill,g_auto,w_1080,h_1080,f_jpg,q_auto/');
}

// Cloudinary genera la transformación (JPG 1080x1080) la primera vez que alguien
// la pide. Si Make se la pide a Instagram justo después de subir la imagen,
// Instagram puede recibir algo que todavía no es un JPG y falla con 9004/9007,
// lo que además apaga el escenario de Make. Por eso el bot "calienta" la URL
// (la pide y espera una respuesta image/*) antes de avisarle a Make.
export async function waitForImage(url, { fetchImpl = fetch, retries = 6, delayMs = 2000 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const resp = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
      if (resp.ok && (resp.headers.get('content-type') || '').startsWith('image/')) return true;
    } catch {
      // error de red: se reintenta igual
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
}

async function sendToMake(text, imageUrl) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('MAKE_WEBHOOK_URL no configurada');

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      networks: { facebook: true, linkedin: true, instagram: true },
      type: 'noticia',
      useAI: false,
      imageUrl,
    }),
  });
  if (!resp.ok) throw new Error(`Make ${resp.status}`);
}

async function publishNoticia({ db, topic, item, content, sourceUrlHash, screenshotUrl }) {
  let imageUrl;
  try {
    imageUrl = await uploadToCloudinary(screenshotUrl);
  } catch (e) {
    await db.collection('noticias').add({
      topicId: topic.id, topicLabel: topic.label,
      title: content.title, body: content.body, caption: content.caption,
      sourceUrl: item.link, sourceUrlHash, sourceTitle: item.title,
      imageUrl: null, status: 'error', makeError: `Cloudinary: ${e.message}`,
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✗ "${content.title}" — Cloudinary falló, guardada como error`);
    return;
  }

  const docRef = await db.collection('noticias').add({
    topicId: topic.id, topicLabel: topic.label,
    title: content.title, body: content.body, caption: content.caption,
    sourceUrl: item.link, sourceUrlHash, sourceTitle: item.title,
    imageUrl, status: 'published', makeError: null,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const noticiaUrl = `${SITE_URL}/noticias/${docRef.id}/`;
  const postText = `${content.body}\n\nLeé la nota completa: ${noticiaUrl}`;

  const makeImageUrl = toInstagramSafeUrl(imageUrl);
  if (!(await waitForImage(makeImageUrl))) {
    await docRef.update({ makeError: 'Imagen para Instagram no estuvo lista, no se envió a Make' });
    console.log(`  ⚠ "${content.title}" — publicada en el sitio, pero la imagen no estuvo lista: no se envió a Make`);
    return;
  }

  try {
    await sendToMake(postText, makeImageUrl);
    console.log(`  ✓ "${content.title}" — publicada y enviada a Make`);
  } catch (e) {
    await docRef.update({ makeError: e.message });
    console.log(`  ⚠ "${content.title}" — publicada en el sitio, pero Make falló: ${e.message}`);
  }
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  const config = await fetchConfig(db);
  if (!config.active) {
    console.log('Bot pausado (noticias_config.active = false). Nada para hacer.');
    return;
  }

  if (!isWithinSchedule(config.schedule, nowArgentina())) {
    console.log('Fuera del horario configurado. Nada para hacer.');
    return;
  }

  let remaining = config.dailyCap != null ? config.dailyCap - await countPublishedToday(db) : Infinity;
  if (remaining <= 0) {
    console.log(`Tope diario (${config.dailyCap}) ya alcanzado hoy. Nada para hacer.`);
    return;
  }

  const topics = await fetchActiveTopics(db);
  console.log(`${topics.length} tópico(s) activo(s).`);

  let publishedCount = 0;
  let errorCount = 0;
  let attempted = 0;

  for (const topic of topics) {
    if (remaining <= 0 || attempted >= MAX_ITEMS_PER_RUN) break;
    console.log(`\n— Tópico: ${topic.label} —`);

    let items;
    try {
      items = await fetchGoogleNewsRss(topic.query || topic.label);
    } catch (e) {
      console.error(`  Error trayendo RSS: ${e.message}`);
      continue;
    }
    console.log(`  ${items.length} item(s) en el RSS.`);

    let attemptedForTopic = 0;
    for (const item of items) {
      if (remaining <= 0 || attempted >= MAX_ITEMS_PER_RUN || attemptedForTopic >= MAX_ITEMS_PER_TOPIC) break;
      const sourceUrlHash = hashUrl(item.link);
      if (await alreadyPublished(db, sourceUrlHash)) continue;

      attempted++;
      attemptedForTopic++;

      // La imagen va primero: si no conseguimos ninguna, descartamos la
      // noticia sin gastar cuota de Gemini (compartida con el resto del sitio).
      const screenshotUrl = await getImageUrl(item.link);
      if (!screenshotUrl) {
        errorCount++;
        await db.collection('noticias').add({
          topicId: topic.id, topicLabel: topic.label,
          title: item.title, body: null, caption: null,
          sourceUrl: item.link, sourceUrlHash, sourceTitle: item.title,
          imageUrl: null, status: 'error', makeError: 'No se pudo obtener imagen (Microlink)',
          publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`  ✗ "${item.title}" — sin imagen, descartada antes de generar contenido`);
        continue;
      }

      try {
        const content = await generateContent(item, topic);
        await publishNoticia({ db, topic, item, content, sourceUrlHash, screenshotUrl });
        publishedCount++;
        remaining--;
      } catch (e) {
        errorCount++;
        console.error(`  Error con "${item.title}": ${e.message}`);
      }
    }
  }

  console.log(`\nListo. Publicadas: ${publishedCount}. Errores: ${errorCount}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    console.error('Error fatal:', e);
    process.exitCode = 1;
  });
}
