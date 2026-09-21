// Bot de noticias — corre en GitHub Actions, no en Vercel. Autocontenido a
// propósito: no importa nada de src/ (esos archivos son CommonJS por default
// en este package.json, y usan sintaxis ESM — un `node` plano no puede
// importarlos desde un script externo al build de Next).
import admin from 'firebase-admin';
import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { renderNoticiaCard } from './noticiaCard.mjs';

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

// Tope de notas de ESTE tópico por corrida (`maxPorCorrida`, se elige en el admin).
// Sin valor (tópicos viejos) o inválido usa MAX_ITEMS_PER_TOPIC; nunca más que
// MAX_ITEMS_PER_RUN. Mismo criterio que normalizeMaxPorCorrida() en
// src/app/api/noticias/topics/route.js.
export function itemsPerRunFor(topic) {
  const n = topic?.maxPorCorrida;
  if (!Number.isInteger(n) || n < 1) return MAX_ITEMS_PER_TOPIC;
  return Math.min(n, MAX_ITEMS_PER_RUN);
}

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
    .map(it => ({
      title: String(it.title || '').trim(),
      link: String(it.link || '').trim(),
      pubDate: it.pubDate || null,
      // <source url="...">Nombre del medio</source>; sin atributos parseados llega como texto
      source: String((typeof it.source === 'object' ? it.source?.['#text'] : it.source) || '').trim(),
    }))
    .filter(it => it.title && it.link)
    .filter(it => {
      const t = it.pubDate ? Date.parse(it.pubDate) : NaN;
      return !Number.isNaN(t) && (now - t) < MAX_ITEM_AGE_MS;
    })
    // Google News RSS /search viene ordenado por relevancia, no por fecha — se ordena acá.
    .sort((a, b) => Date.parse(a.pubDate) - Date.parse(b.pubDate));
}

// Las notas salen en máximo 500 caracteres (decisión del usuario, 2026-09-21). Además
// Instagram rechaza captions de más de 2.200 (error 36004, que deja esa nota sin
// publicar en IG): con este tope nunca se acerca, aun sumando el "\n\nLeé la nota
// completa: URL" (~90) que va aparte. Facebook, Instagram y el sitio comparten el body.
export const MAX_BODY_CHARS = 500;

// Recorta el body al máximo cortando, en orden de preferencia, en un cierre de
// párrafo, en un fin de oración o en un espacio (con "…"), sin dejar frases a medias.
export function fitBody(body, max = MAX_BODY_CHARS) {
  const text = String(body ?? '').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const para = cut.lastIndexOf('\n');
  if (para >= max * 0.5) return cut.slice(0, para).trim();
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentence >= max * 0.5) return cut.slice(0, sentence + 1).trim();
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > 0 ? space : max).trim()}…`;
}

function buildPrompt(item, topic) {
  return `Sos el redactor del canal de noticias de Mariano Aliandri (${SITE_URL}), desarrollador Full Stack y analista de datos de Neuquén, Argentina.

Tenés este titular real como disparador:
Título: ${item.title}
Fuente: ${item.link}
Tópico que seguís: ${topic.label}

Escribí, en español rioplatense (vos, no tú), un JSON con exactamente estas 3 claves, sin texto extra antes ni después ni bloques de código:
{"title": "título propio para la nota, no copies el original tal cual", "body": "1 o 2 párrafos cortos (separados por \\n) que cuenten la noticia completa (qué pasó, quién, cuándo, por qué importa), en total NO más de 450 caracteres contando espacios, tono cercano y profesional, sin inventar datos que no estén en el titular", "caption": "1 a 2 oraciones cortas para un post de red social, SIN incluir ningún link ni URL"}

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
  parsed.body = fitBody(parsed.body); // el prompt lo pide corto, pero no hay garantía (Groq/Gemini se pasan)
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

// Foto principal del artículo (og:image) vía Microlink en modo meta: liviano, no
// renderiza la página entera. Devuelve { url, width, height } o null.
// (Antes se sacaba una captura de pantalla de la página, pero salía recortada y con
// menús/banners de cookies: ilegible. Ahora la imagen es una tarjeta hecha por
// scripts/noticiaCard.mjs, con la foto —si el tópico la usa— solo de fondo.)
async function getArticlePhoto(url) {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false&meta=true`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    const data = await resp.json();
    const img = data?.data?.image;
    if (!img?.url) return null;
    return { url: img.url, width: img.width ?? null, height: img.height ?? null };
  } catch {
    return null;
  }
}

const MIN_PHOTO_WIDTH = 600; // más chica que esto, estirada a 1080 se ve pixelada: mejor el fondo de marca
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
// Varios diarios (ej. Ámbito) responden 403 a un fetch sin User-Agent de navegador.
// No se manda `Accept` a propósito: con image/avif en el Accept algunos servidores
// devuelven AVIF, que satori no sabe dibujar.
const PHOTO_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
};

// Descarga la foto y la deja como data URI (lo que necesita satori). Devuelve null si
// no sirve (muy chica, formato raro, muy pesada, error de red): la tarjeta usa entonces
// el fondo de marca.
export async function fetchPhotoDataUri(photo, { fetchImpl = fetch } = {}) {
  if (!photo?.url) return null;
  if (photo.width != null && photo.width < MIN_PHOTO_WIDTH) return null;
  try {
    const resp = await fetchImpl(photo.url, { signal: AbortSignal.timeout(15000), headers: PHOTO_FETCH_HEADERS });
    if (!resp.ok) return null;
    const type = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return null;
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) return null;
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Sube el PNG de la tarjeta (multipart, sin pasar por URL).
async function uploadToCloudinary(png) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error('CLOUDINARY_CLOUD_NAME o CLOUDINARY_UPLOAD_PRESET no configurados');

  const form = new FormData();
  form.set('file', new Blob([png], { type: 'image/png' }), 'noticia.png');
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
// subir (acá siempre el PNG de la tarjeta, ya en 1080x1350 = 4:5, sin recorte), así
// que pedimos la versión JPG solo para lo que va a Make;
// el `imageUrl` guardado en Firestore para el sitio queda intacto.
export function toInstagramSafeUrl(url) {
  return url.replace('/image/upload/', '/image/upload/f_jpg,q_auto/');
}

// Cloudinary genera la transformación (JPG) la primera vez que alguien
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

// Dónde se publica cada nota según el `destino` del tópico (se elige en el admin):
// 'fb_ig' = Facebook + Instagram (default y lo que hacían todos los tópicos hasta ahora),
// 'linkedin' = SOLO LinkedIn (ej. trabajo remoto, sitios de empleo), 'todas' = las tres.
// Siempre se publica además en el sitio (/noticias). Un valor desconocido cae en 'fb_ig'.
// Mismos valores que DESTINOS en src/app/api/noticias/topics/route.js.
const DESTINOS = {
  fb_ig: { facebook: true, instagram: true, linkedin: false },
  linkedin: { facebook: false, instagram: false, linkedin: true },
  todas: { facebook: true, instagram: true, linkedin: true },
};

export function networksFor(destino) {
  return { ...(DESTINOS[destino] ?? DESTINOS.fb_ig) };
}

async function sendToMake(text, imageUrl, networks) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('MAKE_WEBHOOK_URL no configurada');

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      networks,
      type: 'noticia',
      useAI: false,
      imageUrl,
    }),
  });
  if (!resp.ok) throw new Error(`Make ${resp.status}`);
}

async function publishNoticia({ db, topic, item, content, sourceUrlHash, cardPng, usedPhoto }) {
  let imageUrl;
  try {
    imageUrl = await uploadToCloudinary(cardPng);
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
    imageUrl, imageMode: usedPhoto ? 'foto' : 'marca', destino: topic.destino || 'fb_ig',
    status: 'published', makeError: null,
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
    await sendToMake(postText, makeImageUrl, networksFor(topic.destino));
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
    const topicLimit = itemsPerRunFor(topic);
    for (const item of items) {
      if (remaining <= 0 || attempted >= MAX_ITEMS_PER_RUN || attemptedForTopic >= topicLimit) break;
      const sourceUrlHash = hashUrl(item.link);
      if (await alreadyPublished(db, sourceUrlHash)) continue;

      attempted++;
      attemptedForTopic++;

      try {
        // Con la tarjeta la imagen ya no es un filtro: siempre hay una (la foto del
        // artículo de fondo si el tópico la usa y hay una buena, o el fondo de marca).
        // Por eso primero se genera el texto y después la tarjeta, que lleva el titular.
        const content = await generateContent(item, topic);
        const photoDataUri = topic.usarFoto === false ? null : await fetchPhotoDataUri(await getArticlePhoto(item.link));
        const { png: cardPng, usedPhoto } = await renderNoticiaCard({
          title: content.title, topicLabel: topic.label, topicId: topic.id, source: item.source, photoDataUri,
        });
        console.log(`  Tarjeta: fondo de ${usedPhoto ? 'foto del artículo' : 'marca'}.`);
        await publishNoticia({ db, topic, item, content, sourceUrlHash, cardPng, usedPhoto });
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
