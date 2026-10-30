// Solicitudes de presupuesto (colección `presupuestos`): lo comparten el servidor MCP y el webhook de
// pagos. El formulario público (/api/presupuesto) y el admin (BudgetManager) escriben los mismos campos.
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { FieldValue } from 'firebase-admin/firestore';

const SITE_URL = 'https://marianoaliandri.com.ar';
export const ESTADOS_PRESUPUESTO = ['pending', 'reviewed', 'sent', 'accepted', 'rejected'];
export const ESTADO_LABEL = { pending: 'Pendiente', reviewed: 'Revisado', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado' };

const iso = (ts) => ts?.toDate?.()?.toISOString?.() || null;

// Campos elegidos a mano (nunca el doc crudo).
export function presupuestoResumen(id, d) {
  return {
    id,
    cliente: d.clientName || null,
    empresa: d.clientCompany || null,
    email: d.clientEmail || null,
    telefono: d.clientPhone || null,
    servicios: d.selectedServices || [],
    descripcion: d.projectDescription || null,
    plazo: d.deadline || null,
    estado: d.status || 'pending',
    montoUSD: d.budgetUSD ?? null,
    montoARS: d.budgetARS ?? null,
    linkPago: d.paymentLink || null,
    notas: d.adminNotes || null,
    origen: d.source || 'formulario',
    pagos: Array.isArray(d.payments) ? d.payments : [],
    creado: iso(d.createdAt),
  };
}

// Teléfono para wa.me. Los celulares argentinos van como 549 + área + número (10 dígitos): se saca
// el 54 o el 9 si ya venían, el 0 de larga distancia y el 15 después del área ("0299 15 555-1234").
export function telefonoWa(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.length < 8) return null;
  if (d.startsWith('54')) d = d.slice(2);
  d = d.replace(/^0/, '');
  if (d.length === 11 && d.startsWith('9')) d = d.slice(1);
  if (d.length === 12) {
    const m = d.match(/^(\d{2,4})15(\d{6,8})$/);
    if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2];
  }
  return d.length === 10 ? `549${d}` : `54${d}`;
}

export function mensajePresupuesto(p) {
  const montos = [p.montoUSD ? `USD ${Number(p.montoUSD).toLocaleString('es-AR')}` : '', p.montoARS ? `ARS ${Number(p.montoARS).toLocaleString('es-AR')}` : '']
    .filter(Boolean).join(' / ');
  const lines = [`Hola ${p.cliente || ''}! Soy Mariano Aliandri. Te paso el presupuesto por ${p.servicios.join(', ') || 'lo que me pediste'}.`.replace('Hola !', 'Hola!')];
  if (montos) lines.push(`Total: ${montos}`);
  if (p.notas) lines.push(p.notas);
  if (p.pdfUrl) lines.push(`Presupuesto en PDF: ${p.pdfUrl}`);
  if (p.linkPago) lines.push(`Link de pago: ${p.linkPago}`);
  lines.push('Cualquier duda me escribís por acá.');
  return lines.join('\n');
}

export function whatsappUrl(p, texto = mensajePresupuesto(p)) {
  const tel = telefonoWa(p.telefono);
  return tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : null;
}

// Preferencia de MercadoPago por el monto en pesos. metadata.type = 'presupuesto' hace que el
// webhook de pagos marque el presupuesto como pagado (registrarPagoPresupuesto).
// `titulo` y `metadata` extra los usa la tienda (seña/total y, con user_id, la orden de /mis-compras).
export async function crearLinkPagoPresupuesto(p, montoARS, { titulo, metadata = {} } = {}) {
  const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
  const pref = await new Preference(client).create({
    body: {
      external_reference: `PRESUPUESTO-${p.id}`,
      items: [{
        id: `presupuesto-${p.id}`,
        title: (titulo || `Presupuesto - ${p.cliente || p.empresa || p.id}`).slice(0, 250),
        description: `Servicios: ${p.servicios.join(', ')}`.slice(0, 250),
        category_id: 'services',
        unit_price: Number(montoARS),
        quantity: 1,
        currency_id: 'ARS',
      }],
      payer: p.email ? { email: p.email } : {},
      back_urls: {
        success: `${SITE_URL}/?payment=success`,
        failure: `${SITE_URL}/?payment=failure`,
        pending: `${SITE_URL}/?payment=pending`,
      },
      auto_return: 'approved',
      metadata: { ...metadata, type: 'presupuesto', presupuesto_id: p.id },
      notification_url: `${SITE_URL}/api/payment-webhook/`,
    },
  });
  if (!pref?.init_point) throw new Error('MercadoPago no devolvió el link de pago');
  return pref.init_point;
}

// Pago aprobado de un presupuesto: lo suma a `payments` (sin duplicar por paymentId) y lo marca aceptado.
export async function registrarPagoPresupuesto(db, paymentData) {
  const meta = paymentData.metadata || {};
  const id = meta.presupuesto_id ?? meta.presupuestoId;
  if (!id) throw new Error('Pago de presupuesto sin presupuesto_id en metadata');
  const ref = db.collection('presupuestos').doc(String(id));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error(`No existe el presupuesto ${id}`);
    const pagos = Array.isArray(snap.data().payments) ? snap.data().payments : [];
    const pid = String(paymentData.id);
    if (pagos.some(x => x.id === pid)) return { duplicado: true };
    tx.update(ref, {
      payments: [...pagos, {
        id: pid,
        date: (paymentData.date_approved || new Date().toISOString()).slice(0, 10),
        amount: Number(paymentData.transaction_amount) || 0,
        via: 'mercadopago',
      }],
      paymentId: pid,
      status: 'accepted',
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { duplicado: false };
  });
}
