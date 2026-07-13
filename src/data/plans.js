// Planes del buscador de Rubros / Analítica. Fuente única compartida por:
// - PlansModal (UI de precios)
// - /api/subscribe (monto de la suscripción MercadoPago)
// - /api/keyword-explorer + entitlements (límite de búsquedas)
// - display de cuota en el UI
//
// `limit: null` = ilimitado. `free` no se cobra (registro).
export const PLANS = {
  free: {
    id: 'free',
    name: 'Gratis',
    price: 0,
    limit: 1,           // 1 búsqueda única (lifetime, no se renueva)
    period: 'lifetime',
    highlight: false,
    features: [
      '1 búsqueda de rubros (única)',
      'Acceso a Tendencias y Reportes de Zona',
      'Frases reales de búsqueda',
      'Exportación a CSV',
    ],
  },
  basico: {
    id: 'basico',
    name: 'Básico',
    price: 4999,
    limit: 10,          // 10 búsquedas por mes
    period: 'month',
    highlight: true,
    features: [
      '10 búsquedas de rubros por mes',
      'Acceso completo a Analítica',
      'Frases reales de búsqueda',
      'Exportación a CSV',
      'Renovación automática mensual',
    ],
  },
  full: {
    id: 'full',
    name: 'Full',
    price: 14999,
    limit: null,        // ilimitado
    period: 'month',
    highlight: false,
    features: [
      'Búsquedas de rubros ilimitadas',
      'Acceso completo a Analítica',
      'Frases reales de búsqueda',
      'Exportación a CSV',
      'Renovación automática mensual',
      'Prioridad de soporte',
    ],
  },
};

// Planes pagos, en orden de presentación.
export const PAID_PLAN_IDS = ['basico', 'full'];

export const CURRENCY = 'ARS';

export function getPlan(id) {
  return PLANS[id] || PLANS.free;
}

// Formatea el precio en ARS (sin decimales).
export function formatPlanPrice(price) {
  if (!price) return 'Gratis';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(price);
}
