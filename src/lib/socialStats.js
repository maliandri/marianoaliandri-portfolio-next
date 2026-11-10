// Estadísticas de las redes de Mariano: Instagram por la Graph API (mismo token de página de las
// historias, IG_ACCESS_TOKEN) y LinkedIn a partir de lo que publicaron las automatizaciones.
//
// Instagram: perfil + últimos posts (likes/comentarios) salen con instagram_basic. Alcance, vistas,
// guardados y demás insights necesitan instagram_manage_insights en el token: si falta, se devuelve
// lo básico y `insights.error` dice qué hacer.
//
// LinkedIn: leer métricas exige la Community Management API (r_member_postAnalytics), que todavía
// no está aprobada. Mientras tanto se lista lo publicado desde el sitio (piezas, reels, demanda).
import { FieldValue } from 'firebase-admin/firestore';

const GRAPH_URL = 'https://graph.facebook.com/v23.0';
const DAY = 86400000;

export class SocialStatsError extends Error {}

export const IG_SIN_PERMISO = 'Al token de Instagram le falta el permiso instagram_manage_insights: generar de nuevo '
  + 'el token de página de la app Maliandri_APP con ese permiso y cargarlo en IG_ACCESS_TOKEN (Vercel).';

const ACCOUNT_METRICS = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'saves', 'shares', 'profile_links_taps'];
const ACCOUNT_METRICS_MIN = ['reach', 'accounts_engaged', 'total_interactions'];
const MEDIA_METRICS = ['reach', 'views', 'saved', 'shares', 'total_interactions'];
const MEDIA_METRICS_MIN = ['reach', 'saved', 'total_interactions'];

class GraphError extends Error {
  constructor(status, err = {}) {
    super(`Instagram ${status}${err.code ? ` (${err.code})` : ''}: ${err.message || 'sin detalle'}`);
    this.code = err.code;
  }
}

// Códigos de Meta para "no tenés permiso" (10, 200-299) o token vencido (190).
const sinPermiso = (e) => e?.code === 10 || (e?.code >= 200 && e?.code < 300);

async function graphGet(path, params, { accessToken, fetchImpl }) {
  const qs = new URLSearchParams({ ...params, access_token: accessToken });
  const resp = await fetchImpl(`${GRAPH_URL}/${path}?${qs}`, { signal: AbortSignal.timeout(20000) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) throw new GraphError(resp.status, data.error);
  return data;
}

// Pide las métricas completas y, si Meta rechaza alguna (cambian seguido), reintenta con las mínimas.
async function insightsConRespaldo(path, metricas, minimas, extra, opts) {
  try {
    return await graphGet(path, { metric: metricas.join(','), ...extra }, opts);
  } catch (e) {
    if (sinPermiso(e) || e.code === 190) throw e;
    return graphGet(path, { metric: minimas.join(','), ...extra }, opts);
  }
}

const valorDe = (m) => m?.total_value?.value ?? m?.values?.reduce((s, v) => s + (v.value || 0), 0) ?? null;
const porNombre = (data) => Object.fromEntries((data || []).map(m => [m.name, valorDe(m)]));

export async function fetchInstagramStats({ creds, days = 28, posts = 12, fetchImpl = fetch, now = Date.now() } = {}) {
  if (!creds) throw new SocialStatsError('IG_ACCESS_TOKEN o IG_USER_ID no están configurados.');
  const opts = { accessToken: creds.accessToken, fetchImpl };
  const ig = creds.igUserId;

  let perfil;
  try {
    perfil = await graphGet(ig, { fields: 'username,name,followers_count,follows_count,media_count' }, opts);
  } catch (e) {
    if (e.code === 190) throw new SocialStatsError('El token de Instagram venció o fue revocado: hay que generar uno nuevo.');
    throw new SocialStatsError(`No se pudo leer el perfil de Instagram${e instanceof GraphError ? ` (${e.message})` : ''}.`);
  }

  const media = await graphGet(`${ig}/media`, {
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
    limit: String(posts),
  }, opts).catch(() => ({ data: [] }));

  // La API de insights de cuenta acepta como máximo 30 días.
  const dias = Math.min(days, 30);
  const until = Math.floor(now / 1000);
  const since = until - dias * 86400;
  const insights = { dias, disponible: false, error: null, cuenta: null, seguidoresNuevos: null };
  try {
    const r = await insightsConRespaldo(`${ig}/insights`, ACCOUNT_METRICS, ACCOUNT_METRICS_MIN,
      { period: 'day', metric_type: 'total_value', since: String(since), until: String(until) }, opts);
    insights.cuenta = porNombre(r.data);
    insights.disponible = true;
    const fc = await graphGet(`${ig}/insights`, { metric: 'follower_count', period: 'day', since: String(since), until: String(until) }, opts)
      .catch(() => null);
    if (fc) insights.seguidoresNuevos = valorDe(fc.data?.[0]);
  } catch (e) {
    insights.error = sinPermiso(e) ? IG_SIN_PERMISO
      : `Instagram no devolvió los insights${e instanceof GraphError ? ` (${e.message})` : ''}.`;
  }

  const lista = await Promise.all((media.data || []).map(async (m) => {
    const post = {
      id: m.id, fecha: m.timestamp || null, tipo: m.media_product_type === 'REELS' ? 'reel' : (m.media_type || '').toLowerCase(),
      texto: (m.caption || '').slice(0, 140), url: m.permalink || null,
      likes: m.like_count ?? null, comentarios: m.comments_count ?? null,
    };
    if (!insights.disponible) return post;
    const r = await insightsConRespaldo(`${m.id}/insights`, MEDIA_METRICS, MEDIA_METRICS_MIN, {}, opts).catch(() => null);
    const v = r ? porNombre(r.data) : {};
    return { ...post, alcance: v.reach ?? null, vistas: v.views ?? null, guardados: v.saved ?? null, compartidos: v.shares ?? null, interacciones: v.total_interactions ?? null };
  }));

  return {
    perfil: {
      usuario: perfil.username, nombre: perfil.name || null,
      seguidores: perfil.followers_count ?? null, siguiendo: perfil.follows_count ?? null, publicaciones: perfil.media_count ?? null,
    },
    insights,
    posts: lista,
  };
}

// Guarda los seguidores del día (uno por día) y devuelve la serie de los últimos `dias`. Así se ve
// el crecimiento aunque la API no dé historia de seguidores sin el permiso de insights.
export async function snapshotSeguidores(db, red, seguidores, { now = Date.now(), dias = 90 } = {}) {
  const fecha = new Date(now).toISOString().slice(0, 10);
  const col = db.collection('social_stats');
  if (seguidores != null) {
    await col.doc(`${red}_${fecha}`).set({ red, fecha, seguidores, at: FieldValue.serverTimestamp() }, { merge: true });
  }
  const desde = new Date(now - dias * DAY).toISOString().slice(0, 10);
  const snap = await col.where('red', '==', red).get();
  return snap.docs.map(d => d.data())
    .filter(d => d.fecha >= desde)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map(d => ({ fecha: d.fecha, seguidores: d.seguidores }));
}

export const linkedinPostUrl = (urn) => (urn ? `https://www.linkedin.com/feed/update/${urn}/` : null);

// Lo que salió en LinkedIn desde el sitio, más nuevo primero.
export async function listLinkedInPosts(db, { dias = 28, limit = 30, now = Date.now() } = {}) {
  const desde = now - dias * DAY;
  const [piezas, reels, demanda] = await Promise.all([
    db.collection('contenidos').orderBy('publicadoAtMs', 'desc').limit(60).get(),
    db.collection('reels').orderBy('publicadoAtMs', 'desc').limit(60).get(),
    db.collection('demanda_reportes').orderBy('createdAtMs', 'desc').limit(60).get(),
  ]);
  const out = [];
  for (const d of piezas.docs) {
    const x = d.data();
    if (x.redes?.linkedin?.ok) out.push({ origen: 'pieza', titulo: x.titulo || null, fechaMs: x.publicadoAtMs, urn: x.redes.linkedin.postId || null });
  }
  for (const d of reels.docs) {
    const x = d.data();
    if (x.redes?.linkedin?.ok) out.push({ origen: 'reel', titulo: x.titulo || null, fechaMs: x.publicadoAtMs, urn: x.redes.linkedin.id || null });
  }
  for (const d of demanda.docs) {
    const x = d.data();
    if (x.redes?.linkedin?.ok) out.push({ origen: 'demanda', titulo: x.zona ? `Rubros más buscados en ${x.zona}` : null, fechaMs: x.createdAtMs, urn: x.redes.linkedin.postId || null });
  }
  const fallidos = [...piezas.docs, ...reels.docs, ...demanda.docs]
    .map(d => d.data())
    .filter(x => x.redes?.linkedin && !x.redes.linkedin.ok && (x.publicadoAtMs || x.createdAtMs || 0) >= desde).length;
  const items = out
    .filter(p => (p.fechaMs || 0) >= desde)
    .sort((a, b) => b.fechaMs - a.fechaMs)
    .slice(0, limit)
    .map(p => ({ origen: p.origen, titulo: p.titulo, fecha: new Date(p.fechaMs).toISOString(), url: linkedinPostUrl(p.urn) }));
  return { items, fallidos };
}
