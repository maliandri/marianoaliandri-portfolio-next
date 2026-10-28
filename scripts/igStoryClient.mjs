// Publica una historia de Instagram (imagen o video) con la Graph API. Make no tiene módulo para
// historias (solo foto, carrusel y reel), así que se hace directo, igual que X.
// Dos pasos: crear el contenedor (media_type=STORIES) y publicarlo (media_publish).
// Lo usan el bot de noticias, la auditoría automática (src/lib/autoAuditRun.js) y
// Publicación Libre del admin (/api/publish-story/).
// Tope de Instagram: 100 publicaciones por API cada 24 h (posts + historias).
const GRAPH_URL = 'https://graph.facebook.com/v23.0';

export function igCredsFromEnv(env = process.env) {
  const creds = { accessToken: env.IG_ACCESS_TOKEN, igUserId: env.IG_USER_ID };
  return creds.accessToken && creds.igUserId ? creds : null;
}

async function graphPost(path, params, { accessToken, fetchImpl }) {
  const resp = await fetchImpl(`${GRAPH_URL}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, access_token: accessToken }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.error) {
    const err = data.error || {};
    throw new Error(`Instagram ${resp.status}${err.code ? ` (${err.code})` : ''}: ${err.message || 'sin detalle'}`);
  }
  return data;
}

// Las imágenes suelen quedar listas al instante (los videos tardan más), pero si el contenedor
// sigue IN_PROGRESS media_publish falla con 9007: se espera a FINISHED antes de publicar.
async function waitForContainer(containerId, { accessToken, fetchImpl, retries, delayMs }) {
  for (let i = 0; i < retries; i++) {
    const url = `${GRAPH_URL}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`;
    const resp = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
    const data = await resp.json().catch(() => ({}));
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Instagram: el contenedor quedó en ${data.status_code}`);
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('Instagram: no terminó de procesarse a tiempo');
}

// mediaUrl tiene que ser un JPG público (Instagram no acepta PNG/WebP por URL en historias) o,
// con video: true, un MP4 vertical de hasta 60 s. Devuelve el id de la historia publicada.
export async function publishIgStory(mediaUrl, {
  creds = igCredsFromEnv(), fetchImpl = fetch, video = false, retries = video ? 40 : 10, delayMs = 3000,
} = {}) {
  if (!creds) throw new Error('IG_ACCESS_TOKEN o IG_USER_ID no configurados');
  const opts = { accessToken: creds.accessToken, fetchImpl };
  const media = video ? { video_url: mediaUrl } : { image_url: mediaUrl };
  const container = await graphPost(`${creds.igUserId}/media`, { media_type: 'STORIES', ...media }, opts);
  await waitForContainer(container.id, { ...opts, retries, delayMs });
  const published = await graphPost(`${creds.igUserId}/media_publish`, { creation_id: container.id }, opts);
  return published.id;
}

// Reel de Instagram (MP4 vertical H.264/AAC público). share_to_feed: también aparece en el perfil.
// El video tarda en procesarse: se espera hasta ~5 min a que el contenedor quede FINISHED.
export async function publishIgReel(videoUrl, caption, {
  creds = igCredsFromEnv(), fetchImpl = fetch, retries = 60, delayMs = 5000,
} = {}) {
  if (!creds) throw new Error('IG_ACCESS_TOKEN o IG_USER_ID no configurados');
  const opts = { accessToken: creds.accessToken, fetchImpl };
  const container = await graphPost(`${creds.igUserId}/media`, {
    media_type: 'REELS', video_url: videoUrl, caption: String(caption || '').slice(0, 2200), share_to_feed: 'true',
  }, opts);
  await waitForContainer(container.id, { ...opts, retries, delayMs });
  const published = await graphPost(`${creds.igUserId}/media_publish`, { creation_id: container.id }, opts);
  return published.id;
}

// Reel de la página de Facebook con el mismo token (es un token de página): la API de video_reels va
// en tres pasos (start → subir por URL → finish). Devuelve el id del video.
export async function publishFbReel(videoUrl, description, { creds = igCredsFromEnv(), fetchImpl = fetch } = {}) {
  if (!creds) throw new Error('IG_ACCESS_TOKEN no configurado');
  const opts = { accessToken: creds.accessToken, fetchImpl };
  const meResp = await fetchImpl(`${GRAPH_URL}/me?fields=id&access_token=${encodeURIComponent(creds.accessToken)}`, { signal: AbortSignal.timeout(15000) });
  const me = await meResp.json().catch(() => ({}));
  if (!me.id) throw new Error(`Facebook: no se pudo identificar la página (${me.error?.message || meResp.status})`);
  const start = await graphPost(`${me.id}/video_reels`, { upload_phase: 'start' }, opts);
  const up = await fetchImpl(start.upload_url, {
    method: 'POST', headers: { Authorization: `OAuth ${creds.accessToken}`, file_url: videoUrl }, signal: AbortSignal.timeout(120000),
  });
  const upData = await up.json().catch(() => ({}));
  if (!up.ok || upData.success === false) throw new Error(`Facebook: no se pudo subir el reel (${upData.debug_info?.message || up.status})`);
  await graphPost(`${me.id}/video_reels`, {
    upload_phase: 'finish', video_id: start.video_id, video_state: 'PUBLISHED', description: String(description || '').slice(0, 2200),
  }, opts);
  return start.video_id;
}
