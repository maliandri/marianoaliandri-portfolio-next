// Publicación directa en el perfil de LinkedIn de Mariano (API de LinkedIn, no Make): Make no sube
// documentos, y los informes de demanda salen como post de documento (PDF que se pasa de página).
// Los reels salen como video nativo (publishVideoPost).
// Token: el que guarda la conexión del admin (pestaña LinkedIn → /api/linkedin-auth) en
// `integrations/linkedin`. LinkedIn no da refresh token a esta app: vence a los 60 días y hay que
// reconectar (el chequeo diario avisa, src/lib/healthCheck.js).
const API = 'https://api.linkedin.com/rest';
const DAY = 86400000;

export class LinkedInError extends Error {}

// LinkedIn versiona la API por mes (YYYYMM) y retira cada versión al año: se usa la de hace 2 meses.
export function linkedinVersion(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getLinkedInAuth(db, now = Date.now()) {
  const snap = await db.collection('integrations').doc('linkedin').get();
  if (!snap.exists || !snap.data().accessToken) throw new LinkedInError('LinkedIn no está conectado (admin → LinkedIn → Conectar).');
  const d = snap.data();
  if (d.expiresAt && d.expiresAt <= now) {
    throw new LinkedInError(`La conexión de LinkedIn venció el ${new Date(d.expiresAt).toISOString().slice(0, 10)}: reconectar en admin → LinkedIn.`);
  }
  return { token: d.accessToken, author: `urn:li:person:${d.profileId}`, expiresAt: d.expiresAt || null };
}

// Días que le quedan a la conexión (null si no hay conexión). Lo usa el chequeo diario.
export async function linkedinExpiry(db, now = Date.now()) {
  const snap = await db.collection('integrations').doc('linkedin').get();
  if (!snap.exists || !snap.data().accessToken) return null;
  const exp = snap.data().expiresAt;
  return exp ? { expiresAt: exp, dias: Math.floor((exp - now) / DAY) } : { expiresAt: null, dias: Infinity };
}

// "Little text" de LinkedIn: hay que escapar los caracteres reservados, y los hashtags van como
// plantilla {hashtag|\#|Tag} (un # escapado sale como texto, no como hashtag).
export function littleText(s) {
  return String(s).split(/(#[\p{L}\p{N}_]+)/u).map(part => (
    /^#[\p{L}\p{N}_]+$/u.test(part)
      ? `{hashtag|\\#|${part.slice(1)}}`
      : part.replace(/[\\|{}@[\]()<>#*_~]/g, m => `\\${m}`)
  )).join('');
}

async function call(fetchImpl, url, { token, version, method = 'GET', body, raw, headers = {} }) {
  const res = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(raw ? {} : { 'Content-Type': 'application/json', 'LinkedIn-Version': version, 'X-Restli-Protocol-Version': '2.0.0' }),
      ...headers,
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new LinkedInError(`LinkedIn ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`);
  }
  return res;
}

// Sube el PDF, espera a que LinkedIn lo procese y publica el post. Devuelve el id del post.
export async function publishDocumentPost({ token, author, pdf, title, text, fetchImpl = fetch, now = new Date(), wait = ms => new Promise(r => setTimeout(r, ms)) }) {
  const version = linkedinVersion(now);
  const init = await (await call(fetchImpl, `${API}/documents?action=initializeUpload`, {
    token, version, method: 'POST', body: { initializeUploadRequest: { owner: author } },
  })).json();
  const { uploadUrl, document } = init.value || {};
  if (!uploadUrl || !document) throw new LinkedInError('LinkedIn no devolvió dónde subir el documento.');

  await call(fetchImpl, uploadUrl, { token, method: 'PUT', raw: pdf, headers: { 'Content-Type': 'application/pdf' } });

  // El documento tiene que estar AVAILABLE antes de publicarlo (suele tardar unos segundos).
  for (let i = 0; i < 15; i++) {
    const doc = await (await call(fetchImpl, `${API}/documents/${encodeURIComponent(document)}`, { token, version })).json();
    if (doc.status === 'AVAILABLE') break;
    if (doc.status === 'PROCESSING_FAILED') throw new LinkedInError('LinkedIn no pudo procesar el PDF.');
    if (i === 14) throw new LinkedInError('LinkedIn tardó demasiado en procesar el PDF.');
    await wait(3000);
  }

  return createMediaPost(fetchImpl, { token, version, author, text, title, media: document });
}

async function createMediaPost(fetchImpl, { token, version, author, text, title, media }) {
  const res = await call(fetchImpl, `${API}/posts`, {
    token, version, method: 'POST',
    body: {
      author,
      commentary: littleText(text),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { title: String(title).slice(0, 200), id: media } },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    },
  });
  return res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id') || media;
}

// Video nativo (los reels): initializeUpload da una o más partes (de a 4 MB) → PUT de cada una
// juntando los ETag → finalizeUpload → esperar AVAILABLE → post. Devuelve el id del post.
export async function publishVideoPost({ token, author, video, title, text, fetchImpl = fetch, now = new Date(), wait = ms => new Promise(r => setTimeout(r, ms)) }) {
  const version = linkedinVersion(now);
  const init = await (await call(fetchImpl, `${API}/videos?action=initializeUpload`, {
    token, version, method: 'POST',
    body: { initializeUploadRequest: { owner: author, fileSizeBytes: video.length, uploadCaptions: false, uploadThumbnail: false } },
  })).json();
  const { uploadInstructions, video: urn, uploadToken = '' } = init.value || {};
  if (!uploadInstructions?.length || !urn) throw new LinkedInError('LinkedIn no devolvió dónde subir el video.');

  const partes = [];
  for (const { uploadUrl, firstByte, lastByte } of uploadInstructions) {
    const res = await call(fetchImpl, uploadUrl, {
      token, method: 'PUT', raw: video.subarray(firstByte, lastByte + 1), headers: { 'Content-Type': 'application/octet-stream' },
    });
    const etag = res.headers.get('etag');
    if (!etag) throw new LinkedInError('LinkedIn no confirmó una parte del video.');
    partes.push(etag);
  }
  await call(fetchImpl, `${API}/videos?action=finalizeUpload`, {
    token, version, method: 'POST', body: { finalizeUploadRequest: { video: urn, uploadToken, uploadedPartIds: partes } },
  });

  // Un video tarda más que un PDF en procesarse: hasta ~3 minutos.
  for (let i = 0; i < 36; i++) {
    const v = await (await call(fetchImpl, `${API}/videos/${encodeURIComponent(urn)}`, { token, version })).json();
    if (v.status === 'AVAILABLE') break;
    if (v.status === 'PROCESSING_FAILED') throw new LinkedInError('LinkedIn no pudo procesar el video.');
    if (i === 35) throw new LinkedInError('LinkedIn tardó demasiado en procesar el video.');
    await wait(5000);
  }
  return createMediaPost(fetchImpl, { token, version, author, text, title, media: urn });
}
