// Checkout de la tienda de servicios: guarda el pedido en `presupuestos` (el mismo flujo que el formulario
// /presupuesto, así aparece en admin → Presupuestos y en el MCP) y, si el cliente eligió pagar, crea el link de
// MercadoPago por la seña o el total en pesos. El webhook de pagos (metadata.type = 'presupuesto') lo marca
// Aceptado y te avisa por mail; con user_id además crea la orden de /mis-compras.
import { FieldValue } from 'firebase-admin/firestore';
import { catalogoEfectivo, cotizar, validarCliente, MODOS } from '@/lib/tienda';
import { dolarOficialVenta } from '@/lib/dolar';
import { crearLinkPagoPresupuesto } from '@/lib/presupuestos';

export const PRESUPUESTOS = 'presupuestos';

// Precios y beneficios editados en el admin (service_benefits/{id}).
export async function loadOverrides(db) {
  const snap = await db.collection('service_benefits').get();
  return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
}

export async function checkoutTienda(db, body, {
  user = null,
  dolar = dolarOficialVenta,
  crearLink = crearLinkPagoPresupuesto,
  now = Date.now,
} = {}) {
  const { cliente, error } = validarCliente(body?.cliente);
  if (error) return { status: 400, error };
  const modo = String(body?.modo || '');
  if (!MODOS[modo]) return { status: 400, error: 'Elegí cómo querés pagar' };

  const catalogo = catalogoEfectivo(await loadOverrides(db));
  let q;
  try {
    const cotizacion = modo === 'presupuesto' ? null : (await dolar()).cotizacion;
    q = cotizar({ ids: body?.servicios, modo, catalogo, cotizacion });
  } catch (e) {
    return { status: /cotización/.test(e.message) ? 503 : 400, error: e.message };
  }

  const ref = await db.collection(PRESUPUESTOS).add({
    clientName: cliente.nombre,
    clientEmail: cliente.email,
    clientPhone: cliente.telefono,
    clientCompany: cliente.empresa,
    projectDescription: cliente.notas,
    deadline: '',
    selectedServices: q.items.map(i => i.label),
    servicioIds: q.items.map(i => i.id),
    items: q.items,
    origen: 'tienda',
    modoPago: modo,
    subtotalUSD: q.subtotalUSD,
    descuentoUSD: q.descuentoUSD,
    budgetUSD: q.totalUSD,
    budgetARS: q.totalARS ?? null,
    aPagarUSD: q.aPagarUSD,
    aPagarARS: q.aPagarARS ?? null,
    saldoUSD: q.saldoUSD,
    cotizacion: q.cotizacion ?? null,
    userId: user?.uid || null,
    status: 'pending',
    paymentLink: null,
    paymentId: null,
    adminNotes: '',
    createdAtMs: now(),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (modo === 'presupuesto') return { status: 200, id: ref.id, cotizacionResumen: q };

  const titulo = `${modo === 'sena' ? 'Seña 50%' : 'Pago total'} - ${q.items.length === 1 ? q.items[0].label : `${q.items.length} servicios`} - ${cliente.nombre}`;
  const link = await crearLink(
    { id: ref.id, cliente: cliente.nombre, empresa: cliente.empresa, email: cliente.email, servicios: q.items.map(i => i.label) },
    q.aPagarARS,
    {
      titulo,
      metadata: {
        origen: 'tienda',
        payment_mode: modo === 'sena' ? 'deposit' : 'full',
        ...(user?.uid ? {
          user_id: user.uid,
          user_email: user.email || cliente.email,
          cart_items: JSON.stringify(q.items.map(i => ({ name: i.label, quantity: 1, price: Math.round(i.priceUSD * q.cotizacion) }))),
        } : {}),
      },
    },
  );
  await ref.update({ paymentLink: link, updatedAt: FieldValue.serverTimestamp() });
  return { status: 200, id: ref.id, init_point: link, cotizacionResumen: q };
}
