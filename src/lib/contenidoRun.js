// Bot de contenido: cada corrida toma la serie que toca, le pide la pieza a la IA, arma las placas,
// la guarda en `contenidos` y (si se publica) la manda como carrusel a Facebook + Instagram (Make)
// y como PDF a LinkedIn (API). La página /aprende/<id> solo se ve cuando está publicada.
// La disparan el cron de Vercel (vercel.json, lun–vie 12:00 ART) y el admin (vista previa / publicar).
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { callGemini } from '@/lib/geminiClient';
import { SERIES_SEMILLA } from '@/data/contenidoSeries';
import { pickSerie, buildPrompt, parseContenido, statsAuditorias, buildCaption } from '@/lib/contenido';
import { renderContenidoSlides } from '@/lib/contenidoSlides';
import { uploadPng } from '@/lib/cloudinaryServer';
import { buildFreePostPayload } from '@/lib/freePost';
import { postToMakeSocial } from '@/lib/makeSocial';
import { getLinkedInAuth, publishDocumentPost } from '@/lib/linkedinClient';
import { imagesToPdf } from '@/lib/demandaPublish';
import { sendAlert } from '@/lib/alert';
import { dispararReel, textoReel } from '@/lib/reelDispatch';

const CONFIG = 'contenido_config';
export const CONTENIDOS = 'contenidos';
const LOCK_MS = 10 * 60 * 1000;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export async function loadContenidoConfig(db) {
  const snap = await db.collection(CONFIG).doc('settings').get();
  const d = snap.exists ? snap.data() || {} : {};
  return {
    activo: d.activo === true, // arranca apagado: se prende desde el admin después de ver una vista previa
    series: d.series?.length ? d.series : SERIES_SEMILLA,
    ultimaCorrida: d.ultimaCorrida || {},
    cola: Array.isArray(d.cola) ? d.cola : [],
  };
}

async function groq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('sin GROQ_API_KEY');
  const r = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } }),
    signal: AbortSignal.timeout(90000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `Groq ${r.status}`);
  return j.choices?.[0]?.message?.content;
}

// Gemini suele saturarse (503) o colgarse: se prueban varios modelos y al final Groq. Cada respuesta se
// valida; una que no sirve cuenta como fallo y se pasa a la siguiente. Medido el 2026-10-28: 3.8, 3.7, 3.6 y
// flash-latest daban "high demand"; 3.5-flash y 3.5-flash-lite respondían. gemini-2.5-flash ya no está
// habilitado para cuentas nuevas (las keys satélite de producción). Pocas keys por modelo y timeouts
// cortos: la ruta tiene 300 s en total.
const rapido = { thinkingConfig: { thinkingLevel: 'low' } };
const PROVEEDORES = [
  ['gemini-3.8', (p) => callGemini(p, { timeout: 35000, maxKeys: 2, generationConfig: rapido })],
  ['gemini-3.5', (p) => callGemini(p, { timeout: 60000, maxKeys: 2, model: 'gemini-3.5-flash' })],
  ['gemini-3.5-lite', (p) => callGemini(p, { timeout: 50000, maxKeys: 2, model: 'gemini-3.5-flash-lite' })],
  ['groq', groq],
];

// Genérico: prueba cada IA hasta que una devuelva algo que `parse` acepte (también los guiones semanales).
export async function generarConRespaldo(prompt, parse, proveedores = PROVEEDORES) {
  const errores = [];
  for (const [nombre, fn] of proveedores) {
    try {
      return { ...parse(await fn(prompt)), proveedor: nombre };
    } catch (e) {
      errores.push(`${nombre}: ${e.message}`);
    }
  }
  throw new Error(`Ninguna IA devolvió una respuesta válida (${errores.join(' · ')})`);
}

export const generarPieza = (prompt, proveedores = PROVEEDORES) => generarConRespaldo(prompt, parseContenido, proveedores);

async function recientesDeSerie(db, serieId) {
  const snap = await db.collection(CONTENIDOS).where('serieId', '==', serieId).get();
  return snap.docs.map(d => d.data()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)).slice(0, 12).map(d => d.titulo);
}

async function datosAuditorias(db) {
  const snap = await db.collection('auditorias').orderBy('createdAt', 'desc').limit(25).get();
  return statsAuditorias(snap.docs.map(d => d.data()));
}

function revalidar(id) {
  return import('next/cache')
    .then(({ revalidatePath }) => { revalidatePath('/aprende'); if (id) revalidatePath(`/aprende/${id}`); })
    .catch(() => {});
}

async function acquireLock(db, nowMs) {
  const ref = db.collection(CONFIG).doc('settings');
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if ((snap.exists ? snap.data().lock?.until || 0 : 0) > nowMs) return false;
    tx.set(ref, { lock: { until: nowMs + LOCK_MS } }, { merge: true });
    return true;
  });
}

// Publica una pieza ya generada (borrador o recién creada). Cada red falla por separado.
export async function publicarContenido(db, id) {
  const ref = db.collection(CONTENIDOS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`No existe el contenido ${id}`);
  const c = snap.data();
  if (!c.imagenes?.length) throw new Error('El contenido no tiene placas');
  const caption = buildCaption(c, id);
  const redes = {};
  try {
    await postToMakeSocial(buildFreePostPayload({ text: caption, networks: ['facebook'], images: c.imagenes }), { timeoutMs: 10000 });
    redes.facebookInstagram = { ok: true };
  } catch (e) {
    redes.facebookInstagram = { ok: false, error: e.status ? `Make respondió ${e.status}` : e.message };
  }
  try {
    const { token, author } = await getLinkedInAuth(db);
    const imagenes = [];
    for (const url of c.imagenes) {
      const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`No se pudo bajar la placa (${r.status})`);
      imagenes.push({ bytes: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || 'image/png' });
    }
    const pdf = await imagesToPdf(imagenes, { title: c.titulo });
    redes.linkedin = { ok: true, postId: await publishDocumentPost({ token, author, pdf, title: c.titulo, text: caption }) };
  } catch (e) {
    redes.linkedin = { ok: false, error: e.message };
  }
  const fallas = Object.entries(redes).filter(([, r]) => !r.ok);
  const error = fallas.map(([k, r]) => `${k === 'linkedin' ? 'LinkedIn' : 'Facebook + Instagram'}: ${r.error}`).join(' · ') || null;
  await ref.update({
    estado: 'publicado', publicadoAtMs: Date.now(), publicadoAt: FieldValue.serverTimestamp(), redes, error,
  });
  await revalidar(id);
  if (fallas.length) {
    await sendAlert({ key: `contenido:post:${fallas.map(([k]) => k).join(',')}`, titulo: 'Bot de contenido: falló la publicación en una red', detalle: error, contexto: { contenido: id } });
  }
  return { id, redes, error };
}

// Genera una pieza. publicar=false la deja como borrador (vista previa en el admin, no se ve en el sitio).
// `tema` = la idea puntual de Mariano ("esta es la próxima pieza"); `conReel` = pedir también el reel.
// Sin serieId ni tema, la corrida toma la primera idea de la cola (contenido_config.settings.cola) y,
// si no hay, la serie que toca.
export async function runContenido({ force = false, serieId = null, tema = '', conReel = false, publicar = true, now = Date.now } = {}) {
  const db = getDb();
  if (!db) throw new Error('DB no disponible');
  const nowMs = now();
  const config = await loadContenidoConfig(db);
  if (!force && !config.activo) return { skipped: 'inactivo' };
  const deCola = !serieId && !tema ? config.cola[0] || null : null;
  if (deCola) ({ serieId, tema, conReel } = { serieId: deCola.serieId, tema: deCola.tema, conReel: deCola.conReel });
  const serie = serieId ? config.series.find(s => s.id === serieId) : pickSerie(config.series, config.ultimaCorrida);
  if (!serie) return { skipped: serieId ? 'serie_inexistente' : 'sin_series' };
  if (!(await acquireLock(db, nowMs))) return { skipped: 'en_curso' };

  const patch = { lock: { until: 0 } };
  try {
    const datos = serie.dato === 'auditorias' ? await datosAuditorias(db).catch(() => null) : null;
    const pieza = await generarPieza(buildPrompt(serie, { recientes: await recientesDeSerie(db, serie.id), datos, tema }));
    const ref = await db.collection(CONTENIDOS).add({
      serieId: serie.id, serieNombre: serie.nombre, cta: serie.cta,
      titulo: pieza.titulo, slides: pieza.slides, caption: pieza.caption, cuerpo: pieza.cuerpo, hashtags: pieza.hashtags,
      proveedor: pieza.proveedor, estado: 'borrador', createdAtMs: nowMs, createdAt: FieldValue.serverTimestamp(),
      ...(tema ? { tema } : {}), ...(conReel ? { reelPedido: true } : {}),
    });
    const pngs = await renderContenidoSlides({ ...pieza, serieNombre: serie.nombre }, { ctaLabel: serie.cta.label, ctaPath: serie.cta.path });
    const imagenes = [];
    for (const png of pngs) imagenes.push(await uploadPng(png, `contenido/${ref.id}`));
    await ref.update({ imagenes });
    patch.ultimaCorrida = { [serie.id]: nowMs };
    if (deCola) patch.cola = config.cola.filter(c => c.id !== deCola.id);
    const reel = conReel ? await dispararReel(ref.id) : null;
    const base = { id: ref.id, serie: serie.nombre, titulo: pieza.titulo, imagenes, tema: tema || null, deCola: !!deCola, ...(reel ? { reel: textoReel(reel) } : {}) };

    if (!publicar) return { ...base, estado: 'borrador' };
    const pub = await publicarContenido(db, ref.id);
    return { ...base, estado: 'publicado', redes: pub.redes, error: pub.error };
  } catch (e) {
    await sendAlert({ key: 'contenido:error', titulo: `Bot de contenido: no salió la pieza (${serie.nombre})`, detalle: e.message });
    return { estado: 'error', serie: serie.nombre, error: e.message };
  } finally {
    await db.collection(CONFIG).doc('settings').set(patch, { merge: true })
      .catch(e => console.error('[contenido] no se pudo liberar el candado:', e.message));
  }
}
