export const dynamic = 'force-dynamic';

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { runLeadFinderAction } from '../../lead-finder/route';
import { countProducts, normalizeKeyword } from '@/lib/productCounter';
import { clasificarLead } from '@/lib/leadRule';

// El conteo de productos rastrea varios archivos del sitio del negocio (presupuesto
// interno ~20 s), más que un fetch normal.
export const maxDuration = 30;

// Acciones que solo buscan/listan negocios (sin pedir website/detalle) — no consumen
// créditos, igual que "buscar y explorar" es gratis según lo que le prometimos al dev
// en la landing. La única acción que puede gastar 1 crédito es 'auditPlace', y solo si el negocio resulta lead.
const FREE_ACTIONS = ['geocode', 'searchNearby', 'searchText'];
const PAID_ACTION = 'auditPlace';

// Conteo de productos: gratis (incluido en el crédito de auditPlace). Se cachea aparte del
// caché SEO porque el número depende de la palabra clave de cada cliente.
const COUNT_ACTION = 'countProducts';
const PRODUCT_CACHE_COLLECTION = 'places_product_count';
const PRODUCT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const badRequest = (msg) => Response.json({ ok: false, error: msg }, { status: 400 });

// Se cobra solo por lead (ver src/lib/leadRule.js). Un negocio descartado no gasta crédito, pero
// sí una consulta de detalle a Google: este tope evita que alguien con 1 crédito examine miles
// de negocios gratis (100 × US$0,02 ≈ US$2 por usuario y día en el peor caso).
const DISCARD_LIMIT_PER_DAY = 100;

const isUnlimited = (e) => e?.unlimited === true && e?.status === 'active';
const discardsToday = (e, dayKey) => (e?.descartesHoy?.fecha === dayKey ? e.descartesHoy.n || 0 : 0);

// Patch para descontar 1 crédito, o null si no hay saldo. Prioridad: ilimitado → suscripción
// (cupo mensual) → créditos comprados. Se usa tanto para verificar (antes de auditar) como para
// cobrar (en una transacción, después de saber que es lead).
function chargePatch(e, monthKey) {
  if (!e) return null;
  const base = { auditCount: FieldValue.increment(1), lastAuditAt: FieldValue.serverTimestamp() };
  if (isUnlimited(e)) return base;
  if (e.billingType === 'subscription' && e.status === 'active' && e.planCredits > 0) {
    const used = e.usagePeriod === monthKey ? (e.usageCount || 0) : 0;
    if (used < e.planCredits) return { ...base, usagePeriod: monthKey, usageCount: used + 1 };
  }
  if ((e.credits || 0) > 0) return { ...base, credits: FieldValue.increment(-1) };
  return null;
}

const noPlan = () => Response.json({
  ok: false,
  error: 'No tenés un plan activo de Lead Finder Pro. Elegí un plan para auditar negocios.',
  code: 'NO_PLAN',
}, { status: 402 });

const discardLimit = () => Response.json({
  ok: false,
  error: 'Llegaste al límite diario de negocios revisados sin web ni WhatsApp. Se renueva mañana.',
  code: 'DISCARD_LIMIT',
}, { status: 429 });

// Solo rastrea sitios que ESTE cliente ya auditó: la URL sale de su propio historial, nunca
// del request. Así la acción no sirve para hacer pedir cualquier URL desde nuestro server.
async function handleCountProducts(authUser, body) {
  const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
  const norm = normalizeKeyword(keyword);
  if (!placeId || placeId.includes('/')) return badRequest('placeId requerido');
  if (norm.length < 2 || keyword.length > 60) return badRequest('keyword inválida (2 a 60 caracteres)');

  const db = getDb();
  if (!db) return Response.json({ ok: false, error: 'DB no disponible' }, { status: 500 });

  const auditSnap = await db.collection('leadfinder_client_audits').doc(authUser.uid)
    .collection('audits').doc(placeId).get();
  const siteUrl = auditSnap.exists ? auditSnap.data().siteUrl : null;
  if (!siteUrl) return Response.json({ ok: true, applicable: false });

  const cacheRef = db.collection(PRODUCT_CACHE_COLLECTION).doc(`${placeId}__${norm.replace(/ /g, '-')}`);
  try {
    const cached = await cacheRef.get();
    if (cached.exists && Date.now() - (cached.data().checkedAt || 0) < PRODUCT_CACHE_TTL_MS) {
      const { checkedAt: _c, keyword: _k, ...rest } = cached.data();
      return Response.json({ ok: true, applicable: true, ...rest, fromCache: true });
    }
  } catch { /* si falla la lectura del caché, se cuenta igual */ }

  const result = await countProducts(siteUrl, keyword);

  // Solo se cachea un resultado completo: uno parcial o fallido puede mejorar al reintentar.
  if (result.count !== null && !result.partial) {
    try { await cacheRef.set({ ...result, keyword: norm, checkedAt: Date.now() }); } catch { /* informativo */ }
  }
  return Response.json({ ok: true, applicable: true, ...result, fromCache: false });
}

export async function POST(request) {
  const authUser = await getUserFromRequest(request);
  if (!authUser) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const { action } = body;

  if (action === COUNT_ACTION) return handleCountProducts(authUser, body);

  if (action !== PAID_ACTION && !FREE_ACTIONS.includes(action)) {
    return Response.json({ ok: false, error: 'Acción no permitida' }, { status: 400 });
  }

  if (action === PAID_ACTION) {
    const db = getDb();
    if (!db) return Response.json({ ok: false, error: 'DB no disponible' }, { status: 500 });

    const { placeId } = body;
    if (!placeId) return Response.json({ ok: false, error: 'placeId requerido' }, { status: 400 });

    // Si este cliente ya vio este negocio (lead o descartado), se devuelve gratis y sin Google.
    const myAuditRef = db.collection('leadfinder_client_audits').doc(authUser.uid).collection('audits').doc(placeId);
    const myAuditSnap = await myAuditRef.get();
    if (myAuditSnap.exists) {
      const { auditedAt: _o, ...rest } = myAuditSnap.data();
      return Response.json({ ok: true, ...rest, fromCache: true, fromMyHistory: true });
    }

    const ref = db.collection('leadfinder_entitlements').doc(authUser.uid);
    const now = new Date().toISOString();
    const monthKey = now.slice(0, 7);
    const dayKey = now.slice(0, 10);

    // 1. Verificación previa, sin descontar: tiene saldo y no pasó el tope de descartes.
    const entSnap = await ref.get();
    const ent = entSnap.exists ? entSnap.data() : null;
    if (!chargePatch(ent, monthKey)) return noPlan();
    if (!isUnlimited(ent) && discardsToday(ent, dayKey) >= DISCARD_LIMIT_PER_DAY) return discardLimit();

    // 2. Auditoría (Places + sitio, con caché global de 30 días).
    const { action: _a, apiKey, ...params } = body;
    const resp = await runLeadFinderAction(action, params, apiKey);
    const data = await resp.json();
    if (!data.ok) return Response.json(data, { status: resp.status });

    const { ok: _ok, fromCache, ...audit } = data;
    const cls = clasificarLead(audit);

    // 3. Cobro: lead → 1 crédito (transacción: otra pestaña pudo gastar el último); descartado →
    //    suma al tope diario.
    if (cls.esLead) {
      const charged = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const patch = chargePatch(snap.exists ? snap.data() : null, monthKey);
        if (!patch) return false;
        tx.set(ref, patch, { merge: true });
        return true;
      });
      if (!charged) return noPlan();
    } else {
      const allowed = await db.runTransaction(async tx => {
        const snap = await tx.get(ref);
        const e = snap.exists ? snap.data() : null;
        if (isUnlimited(e)) return true;
        const n = discardsToday(e, dayKey);
        if (n >= DISCARD_LIMIT_PER_DAY) return false;
        tx.set(ref, { descartesHoy: { fecha: dayKey, n: n + 1 } }, { merge: true });
        return true;
      });
      if (!allowed) return discardLimit();
    }

    // 4. Historial personal (también los descartados, para no volver a pagarlos).
    try {
      await myAuditRef.set({ ...audit, ...cls, placeId, auditedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch { /* no romper la respuesta si falla el guardado del historial */ }

    return Response.json({ ok: true, ...audit, ...cls, fromCache: !!fromCache, fromMyHistory: false });
  }

  // Acciones gratis (búsqueda) — sin gate de crédito.
  const { action: _a, apiKey, ...params } = body;
  return runLeadFinderAction(action, params, apiKey);
}
