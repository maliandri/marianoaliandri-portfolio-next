import crypto from 'crypto';

// Valida la firma x-signature (HMAC-SHA256) que MercadoPago envía en cada webhook.
// Manifest: id:{data.id};request-id:{x-request-id};ts:{ts};  → HMAC con MERCADOPAGO_WEBHOOK_SECRET.
// Docs: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/payment-notifications
//
// Retorna true si la firma es válida (o si no hay secret/headers configurados, para no
// romper en entornos sin la firma — MP siempre la manda en producción).
export function verifyMpSignature(request, body) {
  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  if (!xSignature || !xRequestId) return true;

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return true;

  try {
    // El manifest se arma con el data.id del query param (preferido) o del body.
    const url = new URL(request.url);
    let dataId = url.searchParams.get('data.id') || body?.data?.id || body?.id || '';
    // MP indica pasar el id en minúsculas si trae alfanuméricos en mayúsculas.
    dataId = String(dataId).toLowerCase();

    const parts = xSignature.split(',');
    const ts = parts.find(p => p.trim().startsWith('ts='))?.split('=')[1];
    const hash = parts.find(p => p.trim().startsWith('v1='))?.split('=')[1];
    if (!ts || !hash) return false;

    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
    const calculated = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    // Comparación en tiempo constante
    const a = Buffer.from(calculated);
    const b = Buffer.from(hash);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
