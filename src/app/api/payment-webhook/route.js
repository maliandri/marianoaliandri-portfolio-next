export const dynamic = 'force-dynamic';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import admin, { getDb } from '@/lib/firebase-admin';
const db = getDb();


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
  if (!metadata?.cvAnalysis) throw new Error('cvAnalysis no encontrado en metadata');
  const cvAnalysis = JSON.parse(metadata.cvAnalysis);
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

// Acredita un plan de pago único ("project") de Lead Finder Pro. Idempotente: usa el
// paymentId de MercadoPago como llave de deduplicación, porque MP puede reenviar el mismo
// webhook varias veces (reintentos) y no queremos sumar créditos dos veces.
async function creditLeadFinderPlan(paymentData) {
  const metadata = paymentData.metadata;
  const uid = metadata?.uid;
  const planId = metadata?.planId;
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
    return false;
  });
  if (alreadyProcessed) {
    console.warn('[payment-webhook] pago de Lead Finder Pro ya procesado, se ignora:', paymentData.id);
  }
}

async function saveCVOrder(paymentData) {
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
        if (metadata?.cvAnalysis) {
          try { await sendCVAnalysisEmail(paymentData, baseUrl); } catch (e) { console.error(e); }
          try { await saveCVOrder(paymentData); } catch (e) { console.error(e); }
        }
        if (metadata?.type === 'leadfinder_plan') {
          try { await creditLeadFinderPlan(paymentData); } catch (e) { console.error('[payment-webhook] error acreditando Lead Finder Pro:', e); }
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Error en payment-webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
