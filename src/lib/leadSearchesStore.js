import { FieldValue } from 'firebase-admin/firestore';

// Historial de búsquedas por cliente — para volver a ver una búsqueda anterior
// (config + resultados) sin tener que relanzarla contra Google Places.
// Lo usan /api/lead-finder-pro/searches y el servidor MCP.
const COL = 'leadfinder_searches';
const MAX_RESULTS_STORED = 300; // cap defensivo de tamaño del doc

const STAT_KEYS = ['encontrados', 'examinados', 'leads', 'conWeb', 'descartados'];
function cleanStats(s) {
  const out = {};
  for (const k of STAT_KEYS) out[k] = Number.isInteger(s?.[k]) && s[k] >= 0 ? s[k] : 0;
  return out;
}

const toIso = (t) => t?.toDate?.()?.toISOString() || null;
const items = (db, uid) => db.collection(COL).doc(uid).collection('items');

function resumen(d) {
  const data = d.data();
  return {
    id: d.id,
    ciudades: data.ciudades, tipos: data.tipos, terminos: data.terminos, radioKm: data.radioKm,
    resultCount: data.results?.length || 0,
    origen: data.origen || 'cliente', perfil: data.perfil || 'dev', stats: data.stats || null,
    ...(data.via ? { via: data.via } : {}),
    createdAt: toIso(data.createdAt),
  };
}

// Más nuevas primero. `cursor` = createdAt ISO del último ítem de la página anterior.
export async function listSearches(db, uid, { limit = 20, cursor = null } = {}) {
  let q = items(db, uid).orderBy('createdAt', 'desc');
  if (cursor) q = q.startAfter(new Date(cursor));
  const snap = await q.limit(limit + 1).get();
  const docs = snap.docs.slice(0, limit);
  const list = docs.map(resumen);
  const nextCursor = snap.docs.length > limit ? list.at(-1).createdAt : null;
  return { items: list, nextCursor };
}

export async function getSearch(db, uid, id) {
  const snap = await items(db, uid).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return { id: snap.id, ...data, createdAt: toIso(data.createdAt) };
}

// El origen "admin" solo lo puede marcar la cuenta admin: así el historial distingue las
// búsquedas del panel de las que Mariano hace como cliente de prueba.
export async function saveSearch(db, uid, fields, { isAdmin }) {
  const { ciudades, tipos, terminos, radioKm, results, perfil, producto, stats, origen, via } = fields;
  const ref = await items(db, uid).add({
    ciudades: ciudades || [], tipos: tipos || [], terminos: terminos || [], radioKm: radioKm || null,
    perfil: perfil === 'empresa' ? 'empresa' : 'dev',
    producto: typeof producto === 'string' ? producto.trim().slice(0, 60) : '',
    origen: origen === 'admin' && isAdmin ? 'admin' : 'cliente',
    ...(via === 'mcp' ? { via } : {}),
    stats: cleanStats(stats),
    results: (results || []).slice(0, MAX_RESULTS_STORED),
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function deleteSearch(db, uid, id) {
  await items(db, uid).doc(id).delete();
}
