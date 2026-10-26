import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { runLeadFinderAction } from '@/app/api/lead-finder/route';
import { countProducts, normalizeKeyword } from '@/lib/productCounter';
import { clasificarLead } from '@/lib/leadRule';
import { demandaParaLeads, MAX_TERMINOS } from '@/lib/rubroDemand';

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

// Demanda de búsqueda por rubro en la localidad (autocompletado de Google, gratis): incluida
// sin costo en Lead Finder Pro (decisión 2026-10-23). Solo el top 10 + 3 frases por rubro; la
// lista completa y el CSV siguen siendo del producto "Rubros buscados".
const DEMAND_ACTION = 'rubroDemand';

async function handleRubroDemand(body) {
  const localidad = typeof body.localidad === 'string' ? body.localidad.trim() : '';
  if (localidad.length < 2 || localidad.length > 120) return badRequest('localidad inválida');
  const terminos = Array.isArray(body.terminos)
    ? body.terminos.filter(t => typeof t === 'string' && t.trim().length >= 2 && t.length <= 60).slice(0, MAX_TERMINOS)
    : [];
  try {
    return reply({ ok: true, ...(await demandaParaLeads(getDb(), localidad, terminos)) });
  } catch (e) {
    return reply({ ok: false, error: e.message }, 500);
  }
}

const reply = (body, status = 200) => ({ status, body });
const badRequest = (msg) => reply({ ok: false, error: msg }, 400);

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

const noPlan = () => reply({
  ok: false,
  error: 'No tenés un plan activo de Lead Finder Pro. Elegí un plan para auditar negocios.',
  code: 'NO_PLAN',
}, 402);

const discardLimit = () => reply({
  ok: false,
  error: 'Llegaste al límite diario de negocios revisados sin web ni WhatsApp. Se renueva mañana.',
  code: 'DISCARD_LIMIT',
}, 429);

// Solo rastrea sitios que ESTE cliente ya auditó: la URL sale de su propio historial, nunca
// del request. Así la acción no sirve para hacer pedir cualquier URL desde nuestro server.
async function handleCountProducts(authUser, body) {
  const placeId = typeof body.placeId === 'string' ? body.placeId.trim() : '';
  const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : '';
  const norm = normalizeKeyword(keyword);
  if (!placeId || placeId.includes('/')) return badRequest('placeId requerido');
  if (norm.length < 2 || keyword.length > 60) return badRequest('keyword inválida (2 a 60 caracteres)');

  const db = getDb();
  if (!db) return reply({ ok: false, error: 'DB no disponible' }, 500);

  const auditSnap = await db.collection('leadfinder_client_audits').doc(authUser.uid)
    .collection('audits').doc(placeId).get();
  const siteUrl = auditSnap.exists ? auditSnap.data().siteUrl : null;
  if (!siteUrl) return reply({ ok: true, applicable: false });

  const cacheRef = db.collection(PRODUCT_CACHE_COLLECTION).doc(`${placeId}__${norm.replace(/ /g, '-')}`);
  try {
    const cached = await cacheRef.get();
    if (cached.exists && Date.now() - (cached.data().checkedAt || 0) < PRODUCT_CACHE_TTL_MS) {
      const { checkedAt: _c, keyword: _k, ...rest } = cached.data();
      return reply({ ok: true, applicable: true, ...rest, fromCache: true });
    }
  } catch { /* si falla la lectura del caché, se cuenta igual */ }

  const result = await countProducts(siteUrl, keyword);

  // Solo se cachea un resultado completo: uno parcial o fallido puede mejorar al reintentar.
  if (result.count !== null && !result.partial) {
    try { await cacheRef.set({ ...result, keyword: norm, checkedAt: Date.now() }); } catch { /* informativo */ }
  }
  return reply({ ok: true, applicable: true, ...result, fromCache: false });
}

// Lógica de /api/lead-finder-pro/run para un usuario ya autenticado. La comparten la ruta
// (que la envuelve en un Response) y el servidor MCP. Devuelve { status, body }.
export async function runLeadFinderProAction(authUser, body) {
  const { action } = body || {};

  if (action === COUNT_ACTION) return handleCountProducts(authUser, body);
  if (action === DEMAND_ACTION) return handleRubroDemand(body);

  if (action !== PAID_ACTION && !FREE_ACTIONS.includes(action)) {
    return reply({ ok: false, error: 'Acción no permitida' }, 400);
  }

  if (action === PAID_ACTION) {
    const db = getDb();
    if (!db) return reply({ ok: false, error: 'DB no disponible' }, 500);

    const { placeId } = body;
    if (!placeId) return reply({ ok: false, error: 'placeId requerido' }, 400);

    // Si este cliente ya vio este negocio (lead o descartado), se devuelve gratis y sin Google.
    const myAuditRef = db.collection('leadfinder_client_audits').doc(authUser.uid).collection('audits').doc(placeId);
    const myAuditSnap = await myAuditRef.get();
    if (myAuditSnap.exists) {
      const { auditedAt: _o, ...rest } = myAuditSnap.data();
      // Docs anteriores a la clasificación no traen esLead: se deriva al leer, sin reescribir el doc.
      const cls = rest.esLead === undefined ? clasificarLead(rest) : {};
      return reply({ ok: true, ...rest, ...cls, fromCache: true, fromMyHistory: true });
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
    if (!data.ok) return reply(data, resp.status);

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
    } catch (e) { console.error('[lead-finder-pro/run] no se pudo guardar el historial:', e.message); /* no romper la respuesta */ }

    return reply({ ok: true, ...audit, ...cls, fromCache: !!fromCache, fromMyHistory: false });
  }

  // Acciones gratis (búsqueda) — sin gate de crédito.
  const { action: _a, apiKey, ...params } = body;
  const resp = await runLeadFinderAction(action, params, apiKey);
  return reply(await resp.json(), resp.status);
}

// Mismo contrato que el `call` de LeadFinder.jsx: resuelve con el body si ok; si no, lanza un
// Error con `code` (401 → NO_AUTH, 402 → NO_PLAN, si no el code del body).
export function makeLeadFinderCall(user) {
  return async (action, params = {}) => {
    const { status, body } = await runLeadFinderProAction(user, { action, ...params });
    if (status >= 400 || !body?.ok) {
      const code = status === 401 ? 'NO_AUTH' : status === 402 ? 'NO_PLAN' : (body?.code || null);
      throw Object.assign(new Error(body?.error || `Error ${status}`), { code });
    }
    return body;
  };
}
