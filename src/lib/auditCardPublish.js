// Tarjeta de una auditoría YA guardada: la dibuja (src/lib/auditCard.js), la sube a Cloudinary y
// devuelve la URL. La usan las tres vías manuales de publicar (botón de Auditorías, botón del Lead
// Finder vía /api/publish-social, y el MCP), para que salga la misma imagen que en la auditoría
// automática y no una captura de la página.
import { renderAuditCard } from '@/lib/auditCard';
import { uploadPng } from '@/lib/cloudinaryServer';
import { imageIsReachable } from '@/lib/imageCheck';
import { buildStats } from '@/lib/autoAudit';

const AUDIT_ID_RE = /\/auditorias\/([A-Za-z0-9_-]{6,60})\/?(?:[?#].*)?$/;

export function auditIdFromReportUrl(url) {
  const m = String(url || '').match(AUDIT_ID_RE);
  return m ? m[1] : null;
}

// Datos para la tarjeta a partir del documento guardado (config.tiposLabels / ciudades, results, stats).
export function cardDataFromAudit(a) {
  const results = a.results || [];
  const tipos = a.config?.tiposLabels || [];
  const ciudades = a.config?.ciudades || [];
  return {
    rubro: tipos.length === 1 ? tipos[0] : tipos.length ? tipos.join(', ') : 'negocios',
    ciudad: ciudades.join(' · '),
    stats: a.stats || buildStats(results),
    results,
  };
}

// Devuelve la URL de la tarjeta, o tira un Error con un mensaje para mostrar (no se publica nada).
export async function uploadAuditCard(db, auditoriaId) {
  const snap = await db.collection('auditorias').doc(auditoriaId).get();
  if (!snap.exists) throw new Error('No existe esa auditoría.');
  let url;
  try {
    url = await uploadPng(await renderAuditCard(cardDataFromAudit(snap.data())), `auditorias/${auditoriaId}`);
  } catch (e) {
    throw new Error(`No se pudo armar la imagen del informe: ${e.message}`);
  }
  const image = await imageIsReachable(url);
  if (!image.ok) throw new Error(`La imagen del informe no responde (Cloudinary): ${image.detail}`);
  return url;
}

// Si el payload es de una auditoría (metadata.topic === 'auditoria'), cambia su imagen por la tarjeta.
// Cualquier otro payload pasa sin tocarse.
export async function withAuditCard(db, payload) {
  if (payload?.metadata?.topic !== 'auditoria') return payload;
  const id = auditIdFromReportUrl(payload.reportUrl || payload.metadata?.reportUrl || payload.link);
  if (!id) return payload;
  const url = await uploadAuditCard(db, id);
  return { ...payload, imageUrl: url, url };
}
