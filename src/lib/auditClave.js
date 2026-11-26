import { randomBytes, timingSafeEqual } from 'node:crypto';
import { auditoriaLink } from '@/lib/auditPitch';

// Clave de acceso de cada auditoría (desde 2026-11-26 los informes son privados): se guarda en
// `auditorias/{id}.clave` y viaja en el link como ?k=. Sin la clave, /auditorias/<id>/ da 404.
// Solo servidor. Las auditorías viejas no la tienen: asegurarClave() la crea la primera vez que el
// admin (o el MCP) pide el link.

export function nuevaClave() {
  return randomBytes(12).toString('base64url');
}

export function claveValida(data, k) {
  const a = Buffer.from(String(data?.clave || ''));
  const b = Buffer.from(String(k || ''));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function asegurarClave(db, id, data) {
  if (data?.clave) return data.clave;
  const clave = nuevaClave();
  await db.collection('auditorias').doc(id).update({ clave });
  return clave;
}

// Link personal (?k=&para=) de un negocio de un informe, para el mail o el MCP. null si el informe no existe.
export async function linkInforme(db, auditoriaId, negocioId) {
  if (!db || !auditoriaId || String(auditoriaId).includes('/')) return null;
  const snap = await db.collection('auditorias').doc(auditoriaId).get();
  if (!snap.exists) return null;
  return auditoriaLink(auditoriaId, negocioId || null, await asegurarClave(db, auditoriaId, snap.data()));
}
