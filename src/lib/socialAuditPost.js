// Contrato probado de "Publicar en redes" para auditorías (body de /api/publish-social).
// Módulo puro: lo importan tanto componentes cliente como código de servidor.
// NO cambiar nombres de campos: el Router de Make.com depende de ellos.
const SITE_URL = 'https://marianoaliandri.com.ar';

export function auditReportUrl(id) {
  return `${SITE_URL}/auditorias/${id}`;
}

// screenshot=1 oculta navbar/footer/WA; viewport.height corta antes de la tabla.
// Formato vertical 4:5 (1080x1350): la grilla de Instagram recorta del centro, y una captura apaisada
// quedaba descentrada en la miniatura. waitForTimeout deja cargar el mapa antes de capturar.
export function auditScreenshotUrl(id) {
  const shot = `${auditReportUrl(id)}?screenshot=1`;
  return `https://api.microlink.io/?url=${encodeURIComponent(shot)}&screenshot=true&meta=false&embed=screenshot.url&screenshot.type=jpeg&viewport.width=900&viewport.height=1125&viewport.deviceScaleFactor=1.2&waitForTimeout=2500`;
}

// Misma captura en formato celular (540x960 a 2x = 1080x1920, JPG) para la historia de Instagram.
export function auditStoryScreenshotUrl(id) {
  const shot = `${auditReportUrl(id)}?screenshot=1`;
  return `https://api.microlink.io/?url=${encodeURIComponent(shot)}&screenshot=true&meta=false&embed=screenshot.url&screenshot.type=jpeg&viewport.width=540&viewport.height=960&viewport.deviceScaleFactor=2&viewport.isMobile=true`;
}

export function buildAuditPublishPayload({ caption, networks, auditoriaId }) {
  const reportUrl = auditReportUrl(auditoriaId);
  const imageUrl = auditScreenshotUrl(auditoriaId);
  return {
    text:        caption,
    content:     caption,
    caption,
    description: caption,
    message:     caption,
    networks,
    type:        'service',
    useAI:       false,
    aiProvider:  'gemini',
    imageUrl,
    url:         imageUrl,
    link:        reportUrl,
    reportUrl,
    metadata: { topic: 'auditoria', reportUrl, link: reportUrl },
  };
}
