// Subidas a Cloudinary desde el servidor (preset unsigned del admin) y transformaciones por URL.
// Lo usan las historias (/api/publish-story/, src/lib/igStory.js) y el servidor MCP (publicación libre).
const CLOUD = () => process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
const PRESET = 'portfolio_reels';

async function upload(file, { resourceType = 'image', folder = 'social' } = {}) {
  const form = new FormData();
  form.set('file', file);
  form.set('upload_preset', PRESET);
  form.set('folder', folder);
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD()}/${resourceType}/upload`, {
    method: 'POST', body: form, signal: AbortSignal.timeout(60000),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.secure_url) throw new Error(data.error?.message || `Cloudinary ${resp.status}`);
  return data.secure_url;
}

export const uploadPng = (png, folder) => upload(new Blob([png], { type: 'image/png' }), { folder });

// Cloudinary baja el archivo de la URL pública (sirve para imágenes que llegan desde el chat de Claude).
export const uploadFromUrl = (url, { resourceType = 'image', folder } = {}) => upload(url, { resourceType, folder });

const UPLOAD_PREFIX = /^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\//;
export const isCloudinaryUrl = (url) => UPLOAD_PREFIX.test(String(url || ''));

// Separa una URL de Cloudinary en { prefix, kind, path } sacando la transformación que ya traiga
// (el admin sube las fotos con c_fill 4:5): queda solo la versión (v123…) + el public_id.
export function splitCloudinaryUrl(url) {
  const m = String(url || '').match(UPLOAD_PREFIX);
  if (!m) return null;
  const rest = url.slice(m[0].length);
  const v = rest.search(/(^|\/)v\d+\//);
  return { prefix: m[0], kind: m[1], path: v >= 0 ? rest.slice(v).replace(/^\//, '') : rest };
}

// Foto para el feed: 4:5 1080 JPG (lo mismo que hace el admin al subir, + JPG para Instagram).
export function feedImageUrl(url) {
  const s = splitCloudinaryUrl(url);
  if (!s || s.kind !== 'image') return null;
  return `${s.prefix}c_fill,ar_4:5,g_auto,w_1080/f_jpg,q_auto/${s.path}`;
}
