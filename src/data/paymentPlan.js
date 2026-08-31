// Plan de pago de la tienda — editable desde el Admin (persistido en Firestore
// doc `site_config/payment_plan`). Este es el default si no hay override.
//
// - Cada hito tiene un porcentaje (pct). La suma debería dar 100.
// - El PRIMER hito es la "seña": es lo único que se cobra online por MercadoPago.
//   Los hitos siguientes se coordinan por fuera (avance, entrega, etc.).
export const DEFAULT_PAYMENT_PLAN = {
  milestones: [
    { label: 'Adelanto (seña)', pct: 60 },
    { label: 'Por avance',      pct: 20 },
    { label: 'Al finalizar',    pct: 20 },
  ],
};

// Normaliza y valida un plan arbitrario. Devuelve siempre un plan usable.
export function sanitizePlan(plan) {
  const src = plan && Array.isArray(plan.milestones) ? plan.milestones : DEFAULT_PAYMENT_PLAN.milestones;
  const milestones = src
    .map((m) => ({
      label: String(m?.label ?? '').trim() || 'Pago',
      pct: Math.max(0, Math.min(100, Number(m?.pct) || 0)),
    }))
    .filter((m) => m.pct > 0);
  if (!milestones.length) return { ...DEFAULT_PAYMENT_PLAN };
  return { milestones };
}

// Porcentaje de la seña (primer hito) como fracción 0–1.
export function advanceFraction(plan) {
  const p = sanitizePlan(plan);
  return (p.milestones[0]?.pct || 0) / 100;
}
