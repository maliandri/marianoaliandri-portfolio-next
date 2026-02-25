import { CLOUDINARY_CLOUD_NAME } from './constants';

/**
 * Cloudinary Configuration & Helper Functions
 */

// Usar variables de entorno para el Cloud Name
// Crear un archivo .env en la raíz con VITE_CLOUDINARY_CLOUD_NAME=tu_cloud_name
export const CLOUDINARY_CONFIG = {
  cloudName: CLOUDINARY_CLOUD_NAME,
  uploadPreset: 'ml_default', // Cambiar si tienes un preset específico
};

/**
 * Genera URL optimizada de Cloudinary
 * @param {string} publicId - ID público de la imagen en Cloudinary
 * @param {object} options - Opciones de transformación
 * @returns {string} URL optimizada
 */
export const getCloudinaryUrl = (publicId, options = {}) => {
  const cloudName = CLOUDINARY_CONFIG.cloudName;
  if (!cloudName) {
    console.error('Cloudinary cloud name is not configured. Set VITE_CLOUDINARY_CLOUD_NAME in your .env file.');
    return ''; // Devuelve una cadena vacía o una URL de marcador de posición si el cloud name no está configurado
  }

  const {
    width = 'auto',
    quality = 'auto',
    format = 'auto',
    crop = 'scale',
    gravity = 'auto',
    fetchFormat = 'auto',
    dpr = 'auto', // Device Pixel Ratio automático
  } = options;

  const transformations = [
    `w_${width}`,
    `q_${quality}`,
    `f_${format}`,
    `c_${crop}`,
    `g_${gravity}`,
    `dpr_${dpr}`,
  ].join(',');

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformations}/${publicId}`;
};

/**
 * Presets comunes para diferentes usos
 */
export const CLOUDINARY_PRESETS = {
  // Avatar/foto de perfil
  avatar: (publicId) => getCloudinaryUrl(publicId, {
    width: 400,
    quality: 'auto:good',
    crop: 'fill',
    gravity: 'face',
  }),

  // Hero image (grande, optimizada)
  hero: (publicId) => getCloudinaryUrl(publicId, {
    width: 1200,
    quality: 'auto:best',
  }),

  // Thumbnail pequeño
  thumbnail: (publicId) => getCloudinaryUrl(publicId, {
    width: 200,
    quality: 'auto:good',
    crop: 'fill',
  }),

  // Open Graph image (redes sociales)
  ogImage: (publicId) => getCloudinaryUrl(publicId, {
    width: 1200,
    height: 630,
    quality: 'auto:good',
    crop: 'fill',
    gravity: 'auto',
  }),

  // Responsive (múltiples tamaños)
  responsive: (publicId) => ({
    small: getCloudinaryUrl(publicId, { width: 400 }),
    medium: getCloudinaryUrl(publicId, { width: 800 }),
    large: getCloudinaryUrl(publicId, { width: 1200 }),
    xlarge: getCloudinaryUrl(publicId, { width: 1920 }),
  }),
};

/**
 * Genera srcset para imágenes responsive
 * @param {string} publicId - ID público de la imagen
 * @returns {string} srcset completo
 */
export const getResponsiveSrcSet = (publicId) => {
  const sizes = [400, 800, 1200, 1920];
  return sizes
    .map(size => {
      const url = getCloudinaryUrl(publicId, { width: size });
      return `${url} ${size}w`;
    })
    .join(', ');
};
