export const dynamic = 'force-dynamic';

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { runLeadFinderAction } from '../../lead-finder/route';

// Acciones que solo buscan/listan negocios (sin pedir website/detalle) — no consumen
// créditos, igual que "buscar y explorar" es gratis según lo que le prometimos al dev
// en la landing. La única acción que gasta 1 crédito es 'auditPlace' (website + SEO).
const FREE_ACTIONS = ['geocode', 'searchNearby', 'searchText'];
const PAID_ACTION = 'auditPlace';

export async function POST(request) {
  const authUser = await getUserFromRequest(request);
  if (!authUser) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const { action } = body;

  if (action !== PAID_ACTION && !FREE_ACTIONS.includes(action)) {
    return Response.json({ ok: false, error: 'Acción no permitida' }, { status: 400 });
  }

  if (action === PAID_ACTION) {
    const db = getDb();
    if (!db) return Response.json({ ok: false, error: 'DB no disponible' }, { status: 500 });

    const { placeId } = body;
    if (!placeId) return Response.json({ ok: false, error: 'placeId requerido' }, { status: 400 });

    // Si este cliente YA auditó este negocio antes (cualquier búsqueda, cualquier día),
    // se lo devolvemos directo: sin cobrar otro crédito, sin volver a llamar a Google.
    const myAuditRef = db.collection('leadfinder_client_audits').doc(authUser.uid).collection('audits').doc(placeId);
    const myAuditSnap = await myAuditRef.get();
    if (myAuditSnap.exists) {
      const { auditedAt: _o, ...rest } = myAuditSnap.data();
      return Response.json({ ok: true, ...rest, fromCache: true, fromMyHistory: true });
    }

    const ref = db.collection('leadfinder_entitlements').doc(authUser.uid);
    const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM
    const gate = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const e = snap.exists ? snap.data() : null;
      if (!e) return { allowed: false };

      // 1. Acceso "comped" (cortesía otorgada a mano desde el admin) — ilimitado.
      if (e.unlimited === true && e.status === 'active') {
        tx.set(ref, { auditCount: FieldValue.increment(1), lastAuditAt: FieldValue.serverTimestamp() }, { merge: true });
        return { allowed: true };
      }

      // 2. Suscripción activa — cupo mensual (planCredits), se resetea solo al cambiar el mes.
      if (e.billingType === 'subscription' && e.status === 'active' && e.planCredits > 0) {
        const used = e.usagePeriod === monthKey ? (e.usageCount || 0) : 0;
        if (used < e.planCredits) {
          tx.set(ref, {
            usagePeriod: monthKey, usageCount: used + 1,
            auditCount: FieldValue.increment(1), lastAuditAt: FieldValue.serverTimestamp(),
          }, { merge: true });
          return { allowed: true };
        }
      }

      // 3. Saldo de créditos comprado (plan de pago único) — se descuenta por auditoría.
      if ((e.credits || 0) > 0) {
        tx.set(ref, {
          credits: FieldValue.increment(-1),
          auditCount: FieldValue.increment(1), lastAuditAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return { allowed: true };
      }

      return { allowed: false };
    });

    if (!gate.allowed) {
      return Response.json({
        ok: false,
        error: 'No tenés un plan activo de Lead Finder Pro. Elegí un plan para auditar negocios.',
        code: 'NO_PLAN',
      }, { status: 402 });
    }

    // Llama directo a la lógica compartida (Places API + auditoría SEO + caché global).
    const { action: _a, apiKey, ...params } = body;
    const resp = await runLeadFinderAction(action, params, apiKey);

    // Guarda el resultado en el historial personal del cliente (fire-and-forget no —
    // esperamos, para no perder el guardado si el server se corta después de responder).
    try {
      const data = await resp.clone().json();
      if (data.ok) {
        const { ok: _ok, fromCache: _fc, ...toStore } = data;
        await myAuditRef.set({ ...toStore, placeId, auditedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    } catch { /* no romper la respuesta al cliente si falla el guardado del historial */ }

    return resp;
  }

  // Acciones gratis (búsqueda) — sin gate de crédito.
  const { action: _a, apiKey, ...params } = body;
  return runLeadFinderAction(action, params, apiKey);
}
