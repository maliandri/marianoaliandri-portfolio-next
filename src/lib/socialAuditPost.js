// Contrato probado de "Publicar en redes" para auditorías (body de /api/publish-social).
// Módulo puro: lo importan tanto componentes cliente como código de servidor.
// NO cambiar nombres de campos: el Router de Make.com depende de ellos.
const SITE_URL = 'https://marianoaliandri.com.ar';

// Desde 2026-11-26 los informes son privados: sin la clave (auditorias/{id}.clave, ?k=) dan 404.
// Sin clave la URL queda como antes (tests y docs viejos), pero esa ya no abre el informe.
export function auditReportUrl(id, clave) {
  return clave
    ? `${SITE_URL}/auditorias/${id}/?k=${encodeURIComponent(clave)}`
    : `${SITE_URL}/auditorias/${id}`;
}

const shotUrl = (id, clave) => `${auditReportUrl(id, clave)}${clave ? '&' : '?'}screenshot=1`;

// screenshot=1 oculta navbar/footer/WA; viewport.height corta antes de la tabla.
// Captura apaisada (1280x980). La publicación automática ya no la usa (manda la tarjeta de
// src/lib/auditCard.js); sigue para el botón "Publicar en redes" y el MCP.
export function auditScreenshotUrl(id, clave) {
  const shot = shotUrl(id, clave);
  return `https://api.microlink.io/?url=${encodeURIComponent(shot)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=980`;
}

// Misma captura en formato celular (540x960 a 2x = 1080x1920, JPG) para la historia de Instagram.
export function auditStoryScreenshotUrl(id, clave) {
  const shot = shotUrl(id, clave);
  return `https://api.microlink.io/?url=${encodeURIComponent(shot)}&screenshot=true&meta=false&embed=screenshot.url&screenshot.type=jpeg&viewport.width=540&viewport.height=960&viewport.deviceScaleFactor=2&viewport.isMobile=true`;
}

export function buildAuditPublishPayload({ caption, networks, auditoriaId, clave }) {
  const reportUrl = auditReportUrl(auditoriaId, clave);
  const imageUrl = auditScreenshotUrl(auditoriaId, clave);
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
