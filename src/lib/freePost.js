// Publicación libre (admin → Redes Sociales → Publicación Libre, y la tool publish_free_post del MCP):
// mismo payload al webhook de Make que arma src/utils/makeService.js. Módulo puro: lo usan el
// navegador y el servidor. NO cambiar nombres de campos: el Router de Make depende de ellos.
export const MAX_CAROUSEL_IMAGES = 10;

// Instagram solo acepta JPEG en el carrusel: se fuerza f_jpg en las URLs de Cloudinary.
export function carouselFields(images) {
  const list = images.slice(0, MAX_CAROUSEL_IMAGES)
    .map(u => (u.includes('/upload/') && !u.includes('f_jpg') ? u.replace('/upload/', '/upload/f_jpg,q_auto/') : u));
  return {
    isCarousel: true,
    images: list,
    imageUrl: list[0],
    // Con la forma exacta de los módulos de Make (FB photos / IG files): sin Iterator+Aggregator.
    carouselPhotos: list.map(url => ({ type: 'url', url })),
    carouselFiles: list.map(image_url => ({ media_type: 'IMAGE', image_url })),
  };
}

// networks: 'linkedin' y/o 'facebook' (= Facebook + Instagram, como el botón "FB + IG").
// 2+ imágenes = carrusel: solo FB + IG (LinkedIn no lo soporta) y siempre tal cual (sin IA).
export function buildFreePostPayload({ text, networks, images = [], useAI = false, aiProvider = 'gemini' }) {
  const list = images.filter(Boolean);
  const isCarousel = list.length > 1;
  const payload = {
    text, content: text, caption: text, description: text, message: text,
    networks: isCarousel ? networks.filter(n => n !== 'linkedin') : networks,
    type: isCarousel ? 'carousel' : 'custom',
    timestamp: new Date().toISOString(),
    imageUrl: list[0] || null,
    useAI: isCarousel ? false : Boolean(useAI),
    wasPastedImage: false,
    aiProvider,
    metadata: {},
  };
  return isCarousel ? { ...payload, ...carouselFields(list) } : payload;
}
