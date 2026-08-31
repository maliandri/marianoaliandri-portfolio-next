import { getDb } from '@/lib/firebase-admin';
import { PLANS } from '@/data/plans';

const COLLECTION = 'entitlements';

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Límite efectivo por plan: el editable desde Admin > Planes > Analítica (Firestore
// analitica_plans/{id}) pisa el default de plans.js. Cacheado 30s en memoria para no
// pegarle a Firestore en cada búsqueda (mismo patrón que rol_permisos de almamod).
let _limitsCache = null;
let _limitsCacheAt = 0;
async function effectiveLimits() {
  if (_limitsCache && Date.now() - _limitsCacheAt < 30000) return _limitsCache;
  const limits = { free: PLANS.free.limit, basico: PLANS.basico.limit, full: PLANS.full.limit };
  try {
    const db = getDb();
    if (db) {
      const snap = await db.collection('analitica_plans').get();
      snap.forEach(doc => {
        const data = doc.data();
        if (data.limit !== undefined) limits[doc.id] = data.limit;
      });
    }
  } catch { /* si falla, seguimos con los defaults */ }
  _limitsCache = limits;
  _limitsCacheAt = Date.now();
  return limits;
}

// Plan efectivo: un plan pago solo cuenta si está activo; si no, degrada a free.
function effectivePlan(e) {
  if (e?.plan && e.plan !== 'free' && e.planStatus === 'active') return e.plan;
  return 'free';
}

function defaultEntitlement() {
  return {
    plan: 'free',
    planStatus: 'active',
    mpPreapprovalId: null,
    planRenewsAt: null,
    freeUsed: false,
    usagePeriod: monthKey(),
    usageCount: 0,
    updatedAt: new Date().toISOString(),
  };
}

// Búsquedas restantes SIN consumir (para mostrar en el UI). null = ilimitado.
function remainingFor(e, limits) {
  const plan = effectivePlan(e);
  const limit = limits[plan] ?? PLANS.free.limit;
  if (limit === null) return null; // full
  if (plan === 'free') return e.freeUsed ? 0 : 1;
  // básico: cuenta por mes
  const used = e.usagePeriod === monthKey() ? (e.usageCount || 0) : 0;
  return Math.max(0, limit - used);
}

// Lee (o crea implícitamente el default) el entitlement del usuario para mostrarlo.
export async function getEntitlement(uid) {
  const db = getDb();
  if (!db) return null;
  const [snap, limits] = await Promise.all([db.collection(COLLECTION).doc(uid).get(), effectiveLimits()]);
  const e = snap.exists ? snap.data() : defaultEntitlement();
  const plan = effectivePlan(e);
  return {
    plan,
    rawPlan: e.plan || 'free',
    planStatus: e.planStatus || 'active',
    planRenewsAt: e.planRenewsAt || null,
    remaining: remainingFor(e, limits),
    limit: limits[plan] ?? PLANS.free.limit,
  };
}

// Consume una búsqueda de forma atómica. Retorna { allowed, reason, plan, remaining }.
export async function consumeSearch(uid) {
  const db = getDb();
  if (!db) return { allowed: false, reason: 'db_unavailable' };

  const limits = await effectiveLimits();
  const ref = db.collection(COLLECTION).doc(uid);
  const mk = monthKey();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const e = snap.exists ? snap.data() : defaultEntitlement();
    const plan = effectivePlan(e);
    const limit = limits[plan] ?? PLANS.free.limit;
    const now = new Date().toISOString();

    // FULL — ilimitado (contamos solo para métricas)
    if (limit === null) {
      const count = (e.usagePeriod === mk ? (e.usageCount || 0) : 0) + 1;
      tx.set(ref, { ...e, plan, usagePeriod: mk, usageCount: count, updatedAt: now }, { merge: true });
      return { allowed: true, plan, remaining: null };
    }

    // FREE — 1 búsqueda lifetime
    if (plan === 'free') {
      if (e.freeUsed) return { allowed: false, reason: 'need_plan', plan: 'free', remaining: 0 };
      tx.set(ref, { ...e, plan: 'free', freeUsed: true, updatedAt: now }, { merge: true });
      return { allowed: true, plan: 'free', remaining: 0 };
    }

    // BÁSICO — límite mensual (reset si cambió el mes)
    let used = e.usagePeriod === mk ? (e.usageCount || 0) : 0;
    if (used >= limit) {
      return { allowed: false, reason: 'limit', plan, remaining: 0 };
    }
    used += 1;
    tx.set(ref, { ...e, plan, usagePeriod: mk, usageCount: used, updatedAt: now }, { merge: true });
    return { allowed: true, plan, remaining: limit - used };
  });
}

// Activa/actualiza el plan tras un pago o cambio de suscripción (solo server).
export async function setPlan(uid, plan, { preapprovalId = null, status = 'active', renewsAt = null } = {}) {
  const db = getDb();
  if (!db) return false;
  const ref = db.collection(COLLECTION).doc(uid);
  const now = new Date().toISOString();

  // Al activar un plan pago, arrancamos el conteo del mes en 0.
  const patch = {
    plan,
    planStatus: status,
    mpPreapprovalId: preapprovalId,
    planRenewsAt: renewsAt,
    updatedAt: now,
  };
  if (status === 'active' && plan !== 'free') {
    patch.usagePeriod = monthKey();
    patch.usageCount = 0;
  }
  await ref.set(patch, { merge: true });
  return true;
}
