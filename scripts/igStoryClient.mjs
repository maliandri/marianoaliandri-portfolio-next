// Publica una historia de Instagram (imagen) con la Graph API. Make no tiene módulo para
// historias (solo foto, carrusel y reel), así que se hace directo, igual que X.
// Dos pasos: crear el contenedor (media_type=STORIES) y publicarlo (media_publish).
// Lo usan el bot de noticias y la auditoría automática (src/lib/autoAuditRun.js).
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

// Las imágenes suelen quedar listas al instante, pero si el contenedor sigue IN_PROGRESS
// media_publish falla con 9007: se espera a FINISHED antes de publicar.
async function waitForContainer(containerId, { accessToken, fetchImpl, retries, delayMs }) {
  for (let i = 0; i < retries; i++) {
    const url = `${GRAPH_URL}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`;
    const resp = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
    const data = await resp.json().catch(() => ({}));
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Instagram: el contenedor de la historia quedó en ${data.status_code}`);
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('Instagram: la historia no terminó de procesarse a tiempo');
}

// imageUrl tiene que ser un JPG público (Instagram no acepta PNG/WebP por URL en historias).
// Devuelve el id de la historia publicada.
export async function publishIgStory(imageUrl, {
  creds = igCredsFromEnv(), fetchImpl = fetch, retries = 10, delayMs = 3000,
} = {}) {
  if (!creds) throw new Error('IG_ACCESS_TOKEN o IG_USER_ID no configurados');
  const opts = { accessToken: creds.accessToken, fetchImpl };
  const container = await graphPost(`${creds.igUserId}/media`, { media_type: 'STORIES', image_url: imageUrl }, opts);
  await waitForContainer(container.id, { ...opts, retries, delayMs });
  const published = await graphPost(`${creds.igUserId}/media_publish`, { creation_id: container.id }, opts);
  return published.id;
}
