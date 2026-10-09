// Contrato probado de "Publicar en redes" para auditorías (body de /api/publish-social).
// Módulo puro: lo importan tanto componentes cliente como código de servidor.
// NO cambiar nombres de campos: el Router de Make.com depende de ellos.
const SITE_URL = 'https://marianoaliandri.com.ar';

export function auditReportUrl(id) {
  return `${SITE_URL}/auditorias/${id}`;
}

// screenshot=1 oculta navbar/footer/WA; viewport.height corta antes de la tabla
export function auditScreenshotUrl(id) {
  const shot = `${auditReportUrl(id)}?screenshot=1`;
  return `https://api.microlink.io/?url=${encodeURIComponent(shot)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=980`;
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
