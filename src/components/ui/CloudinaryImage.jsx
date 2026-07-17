'use client';

import React from 'react';
import { getCloudinaryUrl, getResponsiveSrcSet } from '../../utils/cloudinary';

/**
 * Componente optimizado para imágenes de Cloudinary
 *
 * @param {string} publicId - ID de la imagen en Cloudinary
 * @param {string} alt - Texto alternativo para accesibilidad
 * @param {string} preset - Preset predefinido (avatar, hero, thumbnail)
 * @param {number} width - Ancho personalizado
 * @param {number} height - Alto personalizado
 * @param {string} className - Clases CSS
 * @param {boolean} responsive - Si debe generar srcset responsive
 * @param {string} loading - Lazy loading (lazy | eager)
 * @param {object} transformations - Transformaciones personalizadas de Cloudinary
 */
export default function CloudinaryImage({
  publicId,
  alt,
  preset,
  width = 'auto',
  height,
  className = '',
  responsive = true,
  loading = 'lazy',
  transformations = {},
  ...props
}) {
  // Obtener URL base
  const baseUrl = getCloudinaryUrl(publicId, {
    width,
    ...transformations,
  });

  // Generar srcset para imágenes responsive
  const srcSet = responsive ? getResponsiveSrcSet(publicId) : undefined;

  // Sizes attribute para responsive images
  const sizes = responsive
    ? '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
    : undefined;

  return (
    <img
      src={baseUrl}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width !== 'auto' ? width : undefined}
      height={height}
      loading={loading}
      className={className}
      {...props}
    />
  );
}

/**
 * Variante especializada para avatares/fotos de perfil
 */
export function CloudinaryAvatar({ publicId, alt, size = 400, className = '', ...props }) {
  const url = getCloudinaryUrl(publicId, {
    width: size,
    height: size,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto:good',
  });

  return (
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className={className}
      loading="eager"
      {...props}
    />
  );
}

/**
 * Variante para imágenes hero (grandes)
 */
export function CloudinaryHero({ publicId, alt, className = '', ...props }) {
  const srcSet = [400, 800, 1200, 1920]
    .map(w => {
      const url = getCloudinaryUrl(publicId, {
        width: w,
        quality: 'auto:best',
      });
      return `${url} ${w}w`;
    })
    .join(', ');

  return (
    <img
      src={getCloudinaryUrl(publicId, { width: 1200, quality: 'auto:best' })}
      srcSet={srcSet}
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
      alt={alt}
      className={className}
      loading="eager"
      {...props}
    />
  );
}
