// Página del presupuesto para el cliente (venta por consulta, 2026-11-25): /tu-presupuesto/<id>/?t=<token>.
// Reusa el token privado del PDF (pdfToken, src/lib/presupuestoPdf.js): el link no se adivina con el id.
// Muestra el presupuesto ya cerrado, en criollo, con el botón de pago de MercadoPago. Sin login.
import { timingSafeEqual } from 'node:crypto';
import { tokenPdf } from '@/lib/presupuestoPdf';

const SITE = 'https://marianoaliandri.com.ar';

export const urlCliente = (id, token) => `${SITE}/tu-presupuesto/${encodeURIComponent(id)}/?t=${encodeURIComponent(token)}`;

export function tokenOk(dado, guardado) {
  if (typeof dado !== 'string' || typeof guardado !== 'string' || !dado || !guardado) return false;
  const a = Buffer.from(dado);
  const b = Buffer.from(guardado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Lo que ve el cliente: nombre, ítems con su beneficio (no el detalle técnico), totales y pago.
export function vistaCliente(id, d = {}) {
  const items = Array.isArray(d.items) && d.items.length
    ? d.items.map(i => ({ titulo: String(i.label || i.nombre || ''), beneficio: String(i.benefit || i.desc || '') })).filter(i => i.titulo)
    : (d.selectedServices || []).map(s => ({ titulo: String(s), beneficio: '' }));
  return {
    nombre: String(d.clientName || '').trim().split(/\s+/)[0] || '',
    numero: d.quoteNumber || id,
    items,
    totalARS: d.totals?.totalARS ?? d.budgetARS ?? null,
    totalUSD: d.totals?.totalUSD ?? d.budgetUSD ?? null,
    linkPago: d.paymentLink || null,
    pagado: d.status === 'accepted' || (Array.isArray(d.payments) && d.payments.length > 0),
  };
}

// Asegura el token (lo crea si no existe) y devuelve el link del cliente. Para el admin y el MCP.
export async function asegurarClienteUrl(db, id) {
  const ref = db.collection('presupuestos').doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) return null;
  return urlCliente(id, await tokenPdf(ref, snap.data()));
}
