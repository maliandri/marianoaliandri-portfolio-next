// Historias de Instagram desde el admin (Publicación Libre → Historia). Make no publica historias:
// se arma el medio en 9:16 con Cloudinary (o la tarjeta de marca si es solo texto) y se publica
// directo con la Graph API (scripts/igStoryClient.mjs).
import { renderNoticiaCard } from '../../scripts/noticiaCard.mjs';
import { publishIgStory } from '../../scripts/igStoryClient.mjs';
import { imageIsReachable } from '@/lib/imageCheck';
import { splitCloudinaryUrl, uploadPng } from '@/lib/cloudinaryServer';

export const STORY_TIPOS = ['texto', 'imagen', 'video'];
const MAX_TITULO = 150;

// Imagen → 1080x1920 JPG sin recortar: la foto entera centrada sobre una versión desenfocada de sí misma.
// (b_blurred solo existe para video: en imágenes da 400 "Invalid color name". Se arma con una capa:
// fondo = la foto ampliada y desenfocada, encima = la misma foto con c_fit.)
export function storyImageUrl(url) {
  const base = splitCloudinaryUrl(url);
  if (!base || base.kind !== 'image') return null;
  const layerId = base.path.replace(/^v\d+\//, '').replace(/\.[a-z0-9]+$/i, '').replace(/\//g, ':');
  return `${base.prefix}c_fill,w_1080,h_1920,e_blur:2000/l_${layerId},c_fit,w_1080,h_1920/fl_layer_apply/f_jpg,q_auto/${base.path}`;
}

// Video → MP4 H.264 1080x1920 (bordes negros si no es vertical), recortado a 60 s.
export function storyVideoUrl(url) {
  const base = splitCloudinaryUrl(url);
  if (!base || base.kind !== 'video') return null;
  return `${base.prefix}c_pad,w_1080,h_1920,b_black,du_60,vc_h264,ac_aac,f_mp4/${base.path.replace(/\.[a-z0-9]+$/i, '')}.mp4`;
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
    const url = await uploadPng(png, 'social/historias');
    return { tipo, mediaUrl: url.replace('/image/upload/', '/image/upload/f_jpg,q_auto/') };
  }

  const url = tipo === 'imagen' ? storyImageUrl(String(mediaUrl ?? '')) : storyVideoUrl(String(mediaUrl ?? ''));
  if (!url) return { error: `Subí ${tipo === 'imagen' ? 'una imagen' : 'un video'} primero (tiene que estar en Cloudinary)` };
  return { tipo, mediaUrl: url };
}

// Publica y deja registro en `ig_stories`. Devuelve { storyId } o lanza con el error de Instagram.
export async function publishStory({ db, tipo, mediaUrl, origen = 'admin' }) {
  const log = { tipo, mediaUrl, origen, createdAt: new Date() };
  try {
    // Cloudinary genera la transformación en el primer pedido: se pide antes para que Instagram la encuentre lista.
    if (tipo !== 'video') {
      const image = await imageIsReachable(mediaUrl);
      if (!image.ok) throw new Error(`La imagen de la historia no está lista (${image.detail})`);
    }
    const storyId = await publishIgStory(mediaUrl, { video: tipo === 'video' });
    await db?.collection('ig_stories').add({ ...log, storyId, error: null });
    return { storyId };
  } catch (e) {
    await db?.collection('ig_stories').add({ ...log, storyId: null, error: e.message });
    throw e;
  }
}
