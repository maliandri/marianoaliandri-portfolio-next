export const dynamic = 'force-dynamic';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { Resend } from 'resend';
import crypto from 'crypto';
import admin, { getDb } from '@/lib/firebase-admin';


function verifyWebhookSignature(rawBody, headers) {
  const xSignature = headers.get('x-signature');
  const xRequestId = headers.get('x-request-id');
  if (!xSignature || !xRequestId) return true;
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;
  try {
    const body = JSON.parse(rawBody);
    const dataId = body.data?.id || body.id;
    const parts = xSignature.split(',');
    const ts = parts.find(p => p.startsWith('ts=')).replace('ts=', '');
    const hash = parts.find(p => p.startsWith('v1=')).replace('v1=', '');
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const calculatedHash = hmac.digest('hex');
    return calculatedHash === hash;
  } catch {
    return true;
  }
}

async function sendCVAnalysisEmail(paymentData, baseUrl) {
  const metadata = paymentData.metadata;
  // Mismo problema que planId/plan_id en creditLeadFinderPlan: MP guarda "cvAnalysis" como
  // "cv_analysis" y lo devuelve así en el webhook.
  const rawCvAnalysis = metadata?.cvAnalysis ?? metadata?.cv_analysis;
  if (!rawCvAnalysis) throw new Error('cvAnalysis no encontrado en metadata');
  const cvAnalysis = JSON.parse(rawCvAnalysis);
  const response = await fetch(`${baseUrl}/api/send-cv-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: metadata.email,
      cvAnalysis,
      paymentId: paymentData.id,
      amount: paymentData.transaction_amount,
      timestamp: metadata.timestamp,
    }),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Error enviando email: ${response.status} - ${err.error}`);
  }
}

// Avisa por email cuando un pago de Lead Finder Pro queda "approved" en MP pero falla la
// acreditación en Firestore — sin esto, el único rastro era un console.error perdido en los
// logs de Vercel y el cliente reclamando créditos que nunca llegaron (pasó de verdad con el
// bug de metadata en snake_case, ver commit que agrego este archivo). No relanza el error:
// una falla mandando el email no debe tapar el error original ni romper el webhook.
async function notifyAdminOfCreditFailure(paymentData, error) {
  try {
    if (!process.env.RESEND_API_KEY) return;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const metadata = paymentData.metadata || {};
    await resend.emails.send({
      from: 'Mariano Aliandri <notificaciones@marianoaliandri.com.ar>',
      to: 'yo@marianoaliandri.com.ar',
      reply_to: 'yo@marianoaliandri.com.ar',
      subject: `⚠ Pago de Lead Finder Pro aprobado sin acreditar (paymentId ${paymentData.id})`,
      html: `
        <p>Un pago de Lead Finder Pro quedó <b>approved</b> en MercadoPago pero falló al acreditar los créditos en Firestore.</p>
        <ul>
          <li>paymentId: ${paymentData.id}</li>
          <li>uid: ${metadata.uid || '(sin uid)'}</li>
          <li>planId: ${metadata.planId ?? metadata.plan_id ?? '(sin planId)'}</li>
          <li>credits: ${metadata.credits || '(sin credits)'}</li>
          <li>monto: ${paymentData.transaction_amount} ${paymentData.currency_id || 'ARS'}</li>
        </ul>
        <p>Error: <code>${error?.message || String(error)}</code></p>
        <p>Acreditar a mano en <code>leadfinder_entitlements/${metadata.uid || '&lt;uid&gt;'}</code>.</p>
      `,
    });
  } catch (e) {
    console.error('[payment-webhook] no se pudo enviar el email de alerta:', e.message);
  }
}

// Acredita un plan de pago único ("project") de Lead Finder Pro. Idempotente: usa el
// paymentId de MercadoPago como llave de deduplicación, porque MP puede reenviar el mismo
// webhook varias veces (reintentos) y no queremos sumar créditos dos veces.
async function creditLeadFinderPlan(paymentData) {
  const db = getDb();
  if (!db) throw new Error('DB no disponible');
  const metadata = paymentData.metadata;
  const uid = metadata?.uid;
  // MercadoPago convierte las claves de metadata a snake_case al guardarlas — mandamos
  // "planId" al crear la preferencia (lead-finder-pro/subscribe/route.js) pero acá vuelve
  // como "plan_id". Sin este fallback, planId queda undefined y Firestore tira excepción
  // al intentar escribirlo (Admin SDK no acepta undefined), el catch de más abajo la traga
  // y el pago queda approved en MP sin acreditar nada — pasó de verdad, ver git blame.
  const planId = metadata?.planId ?? metadata?.plan_id;
  const credits = Number(metadata?.credits) || 0;
  if (!uid || !credits) return;

  const dedupeRef = db.collection('leadfinder_processed_payments').doc(String(paymentData.id));
  const alreadyProcessed = await db.runTransaction(async (tx) => {
    const snap = await tx.get(dedupeRef);
    if (snap.exists) return true;
    tx.set(dedupeRef, { uid, planId, credits, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.set(db.collection('leadfinder_entitlements').doc(uid), {
      credits: admin.firestore.FieldValue.increment(credits),
      billingType: 'project',
      planId,
      status: 'active',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    // Sin esto la compra no aparecía en /mis-compras -- esa pantalla solo lee la
    // colección "orders" (por userId o customerEmail), y acá nunca se escribía ahí.
    tx.set(db.collection('orders').doc(`LFP-${paymentData.id}`), {
      paymentId: paymentData.id,
      type: 'leadfinder_plan',
      userId: uid,
      customerEmail: paymentData.payer?.email || null,
      status: 'approved',
      totalARS: paymentData.transaction_amount,
      items: [{ name: `Lead Finder Pro — ${credits} créditos`, quantity: 1, priceARS: paymentData.transaction_amount }],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      paymentMethod: paymentData.payment_type_id,
      externalReference: paymentData.external_reference,
    });
    return false;
  });
  if (alreadyProcessed) {
    console.warn('[payment-webhook] pago de Lead Finder Pro ya procesado, se ignora:', paymentData.id);
  }
}

async function saveCVOrder(paymentData) {
  const db = getDb();
  if (!db) throw new Error('DB no disponible');
  const metadata = paymentData.metadata;
  await db.collection('orders').doc(`CV-${paymentData.id}`).set({
    paymentId: paymentData.id,
    type: 'cv_analysis',
    customerEmail: metadata.email,
    status: paymentData.status,
    totalARS: paymentData.transaction_amount,
    items: [{ name: 'Informe Detallado de Análisis ATS', quantity: 1, priceARS: paymentData.transaction_amount }],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    paymentMethod: paymentData.payment_type_id,
    externalReference: metadata.external_reference || paymentData.external_reference,
  });
}

// Compras de la Tienda (create-payment/route.js -> Cart.jsx). A diferencia de CV y Lead
// Finder Pro, esta rama no existía -- una compra de tienda aprobada en MP nunca quedaba
// registrada en ningún lado del sitio. "user_id"/"user_email" ya vienen en snake_case desde
// el cliente (Cart.jsx los manda así), no sufren el problema de MP reescribiendo camelCase.
async function saveStoreOrder(paymentData) {
  const db = getDb();
  if (!db) throw new Error('DB no disponible');
  const metadata = paymentData.metadata || {};
  const uid = metadata.user_id;
  if (!uid) return; // sin uid no hay a quién mostrárselo en /mis-compras

  let cartItems = [];
  try { cartItems = JSON.parse(metadata.cart_items || '[]'); } catch { /* items no parseables, se usa el fallback de abajo */ }
  const items = cartItems.length
    ? cartItems.map(i => ({ name: i.name, quantity: i.quantity, priceARS: i.price }))
    : [{ name: 'Compra en la Tienda', quantity: 1, priceARS: paymentData.transaction_amount }];

  await db.collection('orders').doc(`STORE-${paymentData.id}`).set({
    paymentId: paymentData.id,
    type: 'store',
    userId: uid,
    customerEmail: metadata.user_email || paymentData.payer?.email || null,
    status: paymentData.status,
    totalARS: paymentData.transaction_amount,
    items,
    paymentMode: metadata.payment_mode || 'full',
    // Etapas del proyecto -- ver docs/superpowers/specs/2026-09-22-area-cliente-design.md.
    // stageHistory es un array: FieldValue.serverTimestamp() no funciona ahí adentro
    // (limitación de Firestore), por eso Timestamp.now() en vez de FieldValue en este campo.
    stage: 'pago_confirmado',
    stageHistory: [{ stage: 'pago_confirmado', at: admin.firestore.Timestamp.now(), note: '' }],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    paymentMethod: paymentData.payment_type_id,
    externalReference: paymentData.external_reference,
  });
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const dataId = body.data?.id || body.id;
    if (!dataId) {
      return Response.json({ received: true, note: 'Test notification' });
    }

    const isValidSignature = verifyWebhookSignature(rawBody, request.headers);
    if (!isValidSignature) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    if (body.type === 'payment') {
      const baseUrl = new URL(request.url).origin;
      const paymentId = body.data.id;
      const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
      const payment = new Payment(client);
      const paymentData = await payment.get({ id: paymentId });

      if (paymentData.status === 'approved') {
        const metadata = paymentData.metadata;
        if (metadata?.cvAnalysis ?? metadata?.cv_analysis) {
          try { await sendCVAnalysisEmail(paymentData, baseUrl); } catch (e) { console.error(e); }
          try { await saveCVOrder(paymentData); } catch (e) { console.error(e); }
        }
        if (metadata?.type === 'leadfinder_plan') {
          try {
            await creditLeadFinderPlan(paymentData);
          } catch (e) {
            console.error('[payment-webhook] error acreditando Lead Finder Pro:', e);
            await notifyAdminOfCreditFailure(paymentData, e);
          }
        }
        if (metadata?.user_id && metadata?.type !== 'leadfinder_plan') {
          try { await saveStoreOrder(paymentData); } catch (e) { console.error('[payment-webhook] error guardando orden de tienda:', e); }
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Error en payment-webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
