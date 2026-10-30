// Reels automáticos, paso 1 de 3 (GitHub Actions, .github/workflows/reel-bot.yml):
// elige el tipo que toca (explicador / ranking / dato), arma las escenas, genera la voz en off de cada
// una (Gemini TTS) y deja video/props.json + video/public/run/*.wav + video/reel-meta.json.
// Paso 2: Remotion renderiza (video/). Paso 3: scripts/reel-publish.mjs sube y publica.
// Se ejecuta con: npx tsx --tsconfig jsconfig.json scripts/reel-prep.mjs
import fs from 'node:fs';
import path from 'node:path';

const { getDb } = await import('../src/lib/firebase-admin.js');
const { siguientesTipos, reelExplicador, reelRanking, reelDato, duracionEscena, captionReel } = await import('../src/lib/reels.js');
const { statsAuditorias, contenidoUrl } = await import('../src/lib/contenido.js');
const { demandaReportUrl } = await import('../src/lib/demandaReport.js');
const { sintetizar } = await import('../src/lib/geminiTts.js');

const VIDEO = path.resolve('video');
const RUN = path.join(VIDEO, 'public', 'run');
const MUSICA = 'https://res.cloudinary.com/dlshym1te/video/upload/v1767648044/fresh-457883.mp3';

const db = getDb();
if (!db) { console.error('[reel] sin DB'); process.exit(1); }
const cfgRef = db.collection('reels_config').doc('settings');
const cfg = (await cfgRef.get()).data() || {};

// Fuente de cada tipo. Devuelve { reel, fuente: { coleccion, id }, link, hashtags } o null si no hay.
const FUENTES = {
  // Primero la pieza pedida en el disparo (REEL_CONTENIDO_ID), después las marcadas con reelPedido
  // ("Armar también el reel" en el admin) y si no, la más nueva sin reel.
  async explicador() {
    let doc = null;
    if (pedidaId) {
      const d = await db.collection('contenidos').doc(pedidaId).get();
      doc = d.exists && d.data().slides?.length ? d : null;
    }
    if (!doc) {
      const snap = await db.collection('contenidos').orderBy('createdAtMs', 'desc').limit(30).get();
      const libres = snap.docs.filter(d => !d.data().reelId && d.data().slides?.length);
      doc = libres.find(d => d.data().reelPedido) || libres[0];
    }
    if (!doc) return null;
    const c = doc.data();
    return { reel: reelExplicador(c), fuente: { coleccion: 'contenidos', id: doc.id }, link: contenidoUrl(doc.id), hashtags: c.hashtags || [] };
  },
  async ranking() {
    const snap = await db.collection('demanda_reportes').orderBy('createdAtMs', 'desc').limit(10).get();
    const doc = snap.docs.find(d => !d.data().reelId && d.data().top?.length >= 5);
    if (!doc) return null;
    return { reel: reelRanking(doc.data()), fuente: { coleccion: 'demanda_reportes', id: doc.id }, link: demandaReportUrl(doc.id), hashtags: ['MarketingDigital'] };
  },
  async dato() {
    const snap = await db.collection('auditorias').orderBy('createdAt', 'desc').limit(25).get();
    const reel = reelDato(statsAuditorias(snap.docs.map(d => d.data())));
    return reel ? { reel, fuente: { coleccion: 'auditorias', id: null }, link: 'https://marianoaliandri.com.ar/auditorias/', hashtags: ['SEO'] } : null;
  },
};

const pedidaId = process.env.REEL_CONTENIDO_ID || '';
const hayPedidos = !pedidaId && (await db.collection('contenidos').where('reelPedido', '==', true).limit(10).get())
  .docs.some(d => !d.data().reelId);
const pedido = pedidaId || hayPedidos ? 'explicador' : process.env.REEL_TIPO;
let tipo = null;
let elegido = null;
for (const t of pedido ? [pedido] : siguientesTipos(cfg.ultimoTipo)) {
  elegido = await FUENTES[t]?.();
  if (elegido) { tipo = t; break; }
}
if (!elegido) { console.log('[reel] no hay material para ningún tipo'); process.exit(0); }

fs.rmSync(RUN, { recursive: true, force: true });
fs.mkdirSync(RUN, { recursive: true });
const escenas = [];
for (const [i, e] of elegido.reel.escenas.entries()) {
  const { wav, segundos } = await sintetizar(e.voz);
  fs.writeFileSync(path.join(RUN, `voz-${i}.wav`), wav);
  const { voz, ...visible } = e;
  escenas.push({ ...visible, audio: `run/voz-${i}.wav`, dur: duracionEscena(segundos) });
  console.log(`[reel] escena ${i + 1}/${elegido.reel.escenas.length}: ${segundos.toFixed(1)} s`);
}

fs.writeFileSync(path.join(VIDEO, 'props.json'), JSON.stringify({ serie: elegido.reel.serie, musica: MUSICA, escenas }));
fs.writeFileSync(path.join(VIDEO, 'reel-meta.json'), JSON.stringify({
  tipo, titulo: elegido.reel.titulo, fuente: elegido.fuente,
  caption: captionReel(tipo, elegido.reel, { link: elegido.link, hashtags: elegido.hashtags }),
  duracion: escenas.reduce((s, e) => s + e.dur, 0),
}));
await cfgRef.set({ ultimoTipo: tipo }, { merge: true });
console.log(`[reel] listo: ${tipo} — ${elegido.reel.titulo}`);
process.exit(0);
