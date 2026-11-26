import { adminFetch } from '@/utils/adminFetch';
import { auditoriaLink } from '@/lib/auditPitch';

// Abre un informe privado desde el admin cuando la pantalla solo tiene el id (no la clave): la pide a
// /api/auditorias (admin) y navega. La pestaña se abre antes del await para que no la bloquee el navegador.
export async function abrirInforme(auditoriaId) {
  const w = window.open('about:blank', '_blank');
  try {
    const res = await adminFetch(`/api/auditorias?id=${encodeURIComponent(auditoriaId)}`);
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'No se pudo abrir');
    const url = auditoriaLink(auditoriaId, null, d.clave);
    if (w) w.location.href = url; else window.location.href = url;
  } catch {
    w?.close();
  }
}
