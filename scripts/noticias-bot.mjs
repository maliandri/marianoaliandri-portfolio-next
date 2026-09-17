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

// STUB — Task 5 reemplaza este cuerpo por la publicación real (imagen +
// Firestore + Make), sin cambiar la firma de la función. `db` y
// `sourceUrlHash` no se usan todavía acá, los va a necesitar Task 5.
async function publishNoticia({ db, topic, item, content, sourceUrlHash }) {
  console.log(`  [dry-run] publicaría: "${content.title}" (tópico: ${topic.label}, fuente: ${item.link})`);
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
