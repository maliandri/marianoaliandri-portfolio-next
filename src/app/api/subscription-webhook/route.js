export const dynamic = 'force-dynamic';

import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { setPlan } from '@/lib/entitlements';
import { PLANS } from '@/data/plans';
import { verifyMpSignature } from '@/lib/mpWebhook';
import admin, { getDb } from '@/lib/firebase-admin';

// Suscripciones de Lead Finder Pro usan external_reference "lfp:<uid>:<planId>" para
// distinguirse de las de Analítica ("<uid>:<planId>"). El cupo mensual se resetea solo
// (mismo patrón que Analítica: usagePeriod/usageCount comparado contra el mes actual en
// /api/lead-finder-pro/run) — acá solo trackeamos el estado de la suscripción, no créditos.
async function handleLeadFinderProSubscription(uid, planId, status, preapprovalId) {
  const db = getDb();
  if (!db) return;
  const ref = db.collection('leadfinder_entitlements').doc(uid);

  if (status === 'authorized') {
    const planSnap = await db.collection('leadfinder_plans').doc(planId).get();
    const plan = planSnap.exists ? planSnap.data() : null;
    const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await ref.set({
      status: 'active',
      billingType: 'subscription',
      planId,
      planName: plan?.name || planId,
      planCredits: Number(plan?.credits) || 0,
      mpPreapprovalId: preapprovalId,
      renewsAt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } else if (status === 'cancelled' || status === 'paused') {
    await ref.set({ status: 'cancelled', renewsAt: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await ref.set({ status: 'pending', renewsAt: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }
}

// Webhook de MercadoPago para suscripciones (PreApproval).
// Configurar en MP → Webhooks el topic "Suscripciones" apuntando a:
//   https://marianoaliandri.com.ar/api/subscription-webhook/   (¡con barra final!)
// MP envía { type: 'subscription_preapproval', data: { id } } (o via query params).
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const rawBody = await request.text();
    let body = {};
    try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = {}; }

    // Validar firma x-signature de MercadoPago (evita webhooks falsos que activen planes)
    if (!verifyMpSignature(request, body)) {
      return Response.json({ error: 'Firma inválida' }, { status: 401 });
    }

    const type = body?.type || url.searchParams.get('type') || body?.topic || url.searchParams.get('topic');
    const preapprovalId =
      body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');

    // Solo nos interesan eventos de suscripción con un id de preapproval
    if (!preapprovalId || !String(type || '').includes('preapproval')) {
      return Response.json({ ok: true, ignored: true });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    let sub;
    try {
      sub = await new PreApproval(client).get({ id: preapprovalId });
    } catch (e) {
      // MP envía notificaciones de prueba (y a veces reales) con un id de preapproval
      // que no existe en la cuenta (ej. el botón "Simular notificación" usa id ficticio).
      // Responder 200 para no acumular reintentos/fallos por algo que no podemos procesar.
      console.warn('[subscription-webhook] preapproval no encontrado:', preapprovalId, e?.message);
      return Response.json({ ok: true, notFound: true });
    }

    const externalRef = String(sub?.external_reference || '');
    const status = sub?.status; // authorized | pending | cancelled | paused

    // Lead Finder Pro: external_reference = "lfp:<uid>:<planId>"
    if (externalRef.startsWith('lfp:')) {
      const [, uid, planId] = externalRef.split(':');
      if (!uid || !planId) return Response.json({ ok: true, notFound: true });
      await handleLeadFinderProSubscription(uid, planId, status, preapprovalId);
      return Response.json({ ok: true, status, product: 'leadfinder-pro' });
    }

    // Analítica: external_reference = "<uid>:<planId>"
    const [uid, planId] = externalRef.split(':');
    if (!uid || !PLANS[planId]) {
      return Response.json({ ok: true, notFound: true });
    }

    if (status === 'authorized') {
      // Suscripción activa → activar plan; próxima renovación en ~1 mes
      const renewsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await setPlan(uid, planId, { preapprovalId, status: 'active', renewsAt });
    } else if (status === 'cancelled' || status === 'paused') {
      // Cancelada o pausada → degradar a free
      await setPlan(uid, 'free', { preapprovalId, status: 'cancelled', renewsAt: null });
    } else {
      // pending u otros → marcar pendiente sin dar acceso
      await setPlan(uid, planId, { preapprovalId, status: 'pending', renewsAt: null });
    }

    return Response.json({ ok: true, status });
  } catch (e) {
    console.error('[subscription-webhook] ERROR:', e?.message);
    return Response.json({ error: e?.message }, { status: 500 });
  }
}

// MP a veces hace GET de verificación
export async function GET() {
  return Response.json({ ok: true });
}
