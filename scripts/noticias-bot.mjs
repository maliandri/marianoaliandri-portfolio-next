// Bot de noticias — corre en GitHub Actions, no en Vercel. Autocontenido a
// propósito: no importa nada de src/ (esos archivos son CommonJS por default
// en este package.json, y usan sintaxis ESM — un `node` plano no puede
// importarlos desde un script externo al build de Next).
import admin from 'firebase-admin';
import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const SITE_URL = 'https://marianoaliandri.com.ar';

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

async function fetchConfig(db) {
  const doc = await db.collection('noticias_config').doc('settings').get();
  const data = doc.data() || {};
  return { active: data.active !== false, dailyCap: data.dailyCap ?? null };
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
  return items
    .map(it => ({ title: String(it.title || '').trim(), link: String(it.link || '').trim(), pubDate: it.pubDate || null }))
    .filter(it => it.title && it.link)
    .reverse(); // Google trae lo más nuevo primero; procesamos más viejo primero.
}

async function generateContent(item, topic) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

  const prompt = `Sos el redactor del canal de noticias de Mariano Aliandri (${SITE_URL}), desarrollador Full Stack y analista de datos de Neuquén, Argentina.

Tenés este titular real como disparador:
Título: ${item.title}
Fuente: ${item.link}
Tópico que seguís: ${topic.label}

Escribí, en español rioplatense (vos, no tú), un JSON con exactamente estas 3 claves, sin texto extra antes ni después ni bloques de código:
{"title": "título propio para la nota, no copies el original tal cual", "body": "2 a 4 párrafos (separados por \\n) explicando la noticia y por qué importa, tono cercano y profesional, sin inventar datos que no estén en el titular", "caption": "1 a 2 oraciones cortas para un post de red social, SIN incluir ningún link ni URL"}`;

  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  const data = await resp.json();
  if (!resp.ok || data?.error) throw new Error(`Gemini ${resp.status}: ${data?.error?.message || 'error desconocido'}`);

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini no generó texto (posible bloqueo de contenido)');

  const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error('Gemini no devolvió JSON válido');
  }
  if (!parsed.title || !parsed.body || !parsed.caption) throw new Error('JSON de Gemini incompleto (falta title, body o caption)');
  return parsed;
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

async function publishNoticia({ db, topic, item, content, sourceUrlHash }) {
  const screenshotUrl = await getScreenshot(item.link);
  if (!screenshotUrl) {
    await db.collection('noticias').add({
      topicId: topic.id, topicLabel: topic.label,
      title: content.title, body: content.body, caption: content.caption,
      sourceUrl: item.link, sourceUrlHash, sourceTitle: item.title,
      imageUrl: null, status: 'error', makeError: 'No se pudo obtener el screenshot (Microlink)',
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`  ✗ "${content.title}" — sin imagen, guardada como error`);
    return;
  }

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

  try {
    await sendToMake(content.caption, imageUrl);
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

  let remaining = config.dailyCap != null ? config.dailyCap - await countPublishedToday(db) : Infinity;
  if (remaining <= 0) {
    console.log(`Tope diario (${config.dailyCap}) ya alcanzado hoy. Nada para hacer.`);
    return;
  }

  const topics = await fetchActiveTopics(db);
  console.log(`${topics.length} tópico(s) activo(s).`);

  let publishedCount = 0;
  let errorCount = 0;

  for (const topic of topics) {
    if (remaining <= 0) break;
    console.log(`\n— Tópico: ${topic.label} —`);

    let items;
    try {
      items = await fetchGoogleNewsRss(topic.query || topic.label);
    } catch (e) {
      console.error(`  Error trayendo RSS: ${e.message}`);
      continue;
    }
    console.log(`  ${items.length} item(s) en el RSS.`);

    for (const item of items) {
      if (remaining <= 0) break;
      const sourceUrlHash = hashUrl(item.link);
      if (await alreadyPublished(db, sourceUrlHash)) continue;

      try {
        const content = await generateContent(item, topic);
        await publishNoticia({ db, topic, item, content, sourceUrlHash });
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

main().catch(e => {
  console.error('Error fatal:', e);
  process.exitCode = 1;
});
