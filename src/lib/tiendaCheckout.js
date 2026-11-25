// Catálogo y configuración de la tienda en Firestore. Venta por consulta (2026-11-25): la tienda ya no cobra;
// la solicitud la crea src/lib/tiendaSolicitud.js y el cobro sale del presupuesto que arma Mariano.
import { catalogoEfectivo, normalizarItem } from '@/lib/tienda';
import { advanceFraction } from '@/data/paymentPlan';

export const PRESUPUESTOS = 'presupuestos';

// Seña = primer hito del plan de pago (admin → Tienda, site_config/payment_plan). Sin plan guardado: 50%.
export async function loadSenaPct(db) {
  const snap = await db.collection('site_config').doc('payment_plan').get();
  return snap.exists ? advanceFraction(snap.data()) || 0.5 : 0.5;
}

// Precios y beneficios editados en el admin ANTES de pasar el catálogo a Firestore (service_benefits/{id}).
// Solo se usan mientras `tienda_catalogo` esté vacía.
export async function loadOverrides(db) {
  const snap = await db.collection('service_benefits').get();
  return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]));
}

export const CATALOGO = 'tienda_catalogo';

// Catálogo de la tienda como lista plana (activos e inactivos; filtrar con agruparCatalogo). La fuente es la
// colección `tienda_catalogo`; si está vacía (todavía no se cargó desde admin → Tienda) cae al del código
// con los precios editados en service_benefits.
export async function cargarCatalogo(db) {
  const snap = await db.collection(CATALOGO).get();
  if (snap.empty) return catalogoEfectivo(await loadOverrides(db));
  return snap.docs.map((d, i) => normalizarItem(d.id, d.data(), i));
}
