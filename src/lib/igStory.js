// Historias de Instagram desde el admin (Publicación Libre → Historia). Make no publica historias:
// se arma el medio en 9:16 con Cloudinary (o la tarjeta de marca si es solo texto) y se publica
// directo con la Graph API (scripts/igStoryClient.mjs).
import { renderNoticiaCard } from '../../scripts/noticiaCard.mjs';
import { publishIgStory } from '../../scripts/igStoryClient.mjs';
import { imageIsReachable } from '@/lib/imageCheck';

export const STORY_TIPOS = ['texto', 'imagen', 'video'];
const MAX_TITULO = 150;

const CLOUDINARY_UPLOAD = /^https:\/\/res\.cloudinary\.com\/[^/]+\/(image|video)\/upload\//;

// Saca la transformación que ya traiga la URL (el admin sube las fotos con c_fill 4:5) y deja
// solo la versión (v123…) + el public_id, para aplicar la de historia.
function baseCloudinaryPath(url) {
  const m = url.match(CLOUDINARY_UPLOAD);
  if (!m) return null;
  const rest = url.slice(m[0].length);
  const v = rest.search(/(^|\/)v\d+\//);
  return { prefix: m[0], path: v >= 0 ? rest.slice(v).replace(/^\//, '') : rest };
}

// Imagen → 1080x1920 JPG sin recortar: la foto entera centrada sobre una versión desenfocada de sí misma.
export function storyImageUrl(url) {
  const base = baseCloudinaryPath(url);
  if (!base || !base.prefix.includes('/image/')) return null;
  return `${base.prefix}b_blurred:400:15,c_pad,w_1080,h_1920,f_jpg,q_auto/${base.path}`;
}

// Video → MP4 H.264 1080x1920 (bordes negros si no es vertical), recortado a 60 s.
export function storyVideoUrl(url) {
  const base = baseCloudinaryPath(url);
  if (!base || !base.prefix.includes('/video/')) return null;
  return `${base.prefix}c_pad,w_1080,h_1920,b_black,du_60,vc_h264,ac_aac,f_mp4/${base.path.replace(/\.[a-z0-9]+$/i, '')}.mp4`;
}

async function uploadPng(png) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dlshym1te';
  const form = new FormData();
  form.set('file', new Blob([png], { type: 'image/png' }), 'historia.png');
  form.set('upload_preset', 'portfolio_reels');
  form.set('folder', 'social/historias');
  const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
  const data = await resp.json();
  if (!resp.ok || !data.secure_url) throw new Error(data.error?.message || `Cloudinary ${resp.status}`);
  return data.secure_url.replace('/image/upload/', '/image/upload/f_jpg,q_auto/');
}

// Valida el pedido y devuelve { tipo, mediaUrl } listo para previsualizar o publicar,
// o { error } con el motivo para el usuario.
export async function buildStoryMedia({ tipo, titulo, etiqueta, mediaUrl } = {}) {
  if (!STORY_TIPOS.includes(tipo)) return { error: `tipo debe ser uno de: ${STORY_TIPOS.join(', ')}` };

  if (tipo === 'texto') {
    const t = String(titulo ?? '').trim();
    if (!t) return { error: 'Escribí el texto de la historia' };
    if (t.length > MAX_TITULO) return { error: `El texto de la historia admite hasta ${MAX_TITULO} caracteres` };
    const { png } = await renderNoticiaCard({
      title: t, topicLabel: String(etiqueta ?? '').trim() || 'Mariano Aliandri', topicId: 'historia', format: 'story',
    });
    return { tipo, mediaUrl: await uploadPng(png) };
  }

  const url = tipo === 'imagen' ? storyImageUrl(String(mediaUrl ?? '')) : storyVideoUrl(String(mediaUrl ?? ''));
  if (!url) return { error: `Subí ${tipo === 'imagen' ? 'una imagen' : 'un video'} primero (tiene que estar en Cloudinary)` };
  return { tipo, mediaUrl: url };
}

// Publica y deja registro en `ig_stories`. Devuelve { storyId } o lanza con el error de Instagram.
export async function publishStory({ db, tipo, mediaUrl, origen = 'admin' }) {
  // Cloudinary genera la transformación en el primer pedido: se pide antes para que Instagram la encuentre lista.
  if (tipo !== 'video') {
    const image = await imageIsReachable(mediaUrl);
    if (!image.ok) throw new Error(`La imagen de la historia no está lista (${image.detail})`);
  }
  const log = { tipo, mediaUrl, origen, createdAt: new Date() };
  try {
    const storyId = await publishIgStory(mediaUrl, { video: tipo === 'video' });
    await db?.collection('ig_stories').add({ ...log, storyId, error: null });
    return { storyId };
  } catch (e) {
    await db?.collection('ig_stories').add({ ...log, storyId: null, error: e.message });
    throw e;
  }
}
