import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import admin, { db } from '@/lib/firebase-admin';

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
const payment = new Payment(client);

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
      const paymentData = await payment.get({ id: paymentId });

      if (paymentData.status === 'approved') {
        const metadata = paymentData.metadata;
        if (metadata?.cvAnalysis) {
          try { await sendCVAnalysisEmail(paymentData, baseUrl); } catch (e) { console.error(e); }
          try { await saveCVOrder(paymentData); } catch (e) { console.error(e); }
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Error en payment-webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
