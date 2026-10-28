// Compartir un reel a mano desde el admin (WhatsApp, TikTok, Estados…). Módulo puro, sin I/O.
// Celular: Web Share con el archivo (abre la hoja de compartir: WhatsApp chat o Estado, TikTok, etc.).
// PC: WhatsApp Web no acepta archivos desde otra página, así que va el texto + el link al video.

// Cloudinary sirve el archivo como descarga con fl_attachment (sin eso el navegador lo reproduce).
export function reelDownloadUrl(videoUrl, nombre = 'reel') {
  const limpio = String(nombre).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'reel';
  return String(videoUrl).includes('/upload/')
    ? String(videoUrl).replace('/upload/', `/upload/fl_attachment:${limpio}/`)
    : videoUrl;
}

// Primera línea del caption (el gancho) + link al video. api.whatsapp.com abre la app en el celular
// y WhatsApp Web en la PC.
export function whatsappShareUrl(caption, videoUrl) {
  const gancho = String(caption || '').split('\n').find(l => l.trim()) || '';
  return `https://api.whatsapp.com/send?text=${encodeURIComponent([gancho, videoUrl].filter(Boolean).join('\n\n'))}`;
}
