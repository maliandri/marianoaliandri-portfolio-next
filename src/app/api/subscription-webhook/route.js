export const dynamic = 'force-dynamic';

import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { setPlan } from '@/lib/entitlements';
import { PLANS } from '@/data/plans';

// Webhook de MercadoPago para suscripciones (PreApproval).
// Configurar en MP → Webhooks el topic "Suscripciones" apuntando a:
//   https://marianoaliandri.com.ar/api/subscription-webhook/   (¡con barra final!)
// MP envía { type: 'subscription_preapproval', data: { id } } (o via query params).
export async function POST(request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));

    const type = body?.type || url.searchParams.get('type') || body?.topic || url.searchParams.get('topic');
    const preapprovalId =
      body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');

    // Solo nos interesan eventos de suscripción con un id de preapproval
    if (!preapprovalId || !String(type || '').includes('preapproval')) {
      return Response.json({ ok: true, ignored: true });
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const sub = await new PreApproval(client).get({ id: preapprovalId });

    // external_reference = "<uid>:<planId>"
    const [uid, planId] = String(sub?.external_reference || '').split(':');
    if (!uid || !PLANS[planId]) {
      return Response.json({ ok: true, notFound: true });
    }

    const status = sub?.status; // authorized | pending | cancelled | paused
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
