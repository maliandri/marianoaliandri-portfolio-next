export const dynamic = 'force-dynamic';

import { MercadoPagoConfig, Preference, PreApproval } from 'mercadopago';
import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';

// POST /api/lead-finder-pro/subscribe  { planId }
// Crea el checkout de MercadoPago para un plan de Lead Finder Pro y devuelve initPoint.
// - billingType 'subscription' → PreApproval (cobro mensual automático), cupo se resetea
//   cada mes mientras la suscripción siga 'active' (igual que Analítica).
// - billingType 'project' → Preference (pago único), acredita `credits` una sola vez.
// Requiere header Authorization: Bearer <idToken>.
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return Response.json({ error: 'Necesitás iniciar sesión' }, { status: 401 });
    if (!user.email) return Response.json({ error: 'Tu cuenta no tiene email asociado' }, { status: 400 });

    const { planId } = await request.json().catch(() => ({}));
    if (!planId) return Response.json({ error: 'planId requerido' }, { status: 400 });

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const planSnap = await db.collection('leadfinder_plans').doc(planId).get();
    if (!planSnap.exists || planSnap.data().active === false) {
      return Response.json({ error: 'Plan inválido' }, { status: 400 });
    }
    const plan = planSnap.data();
    const priceARS = Number(plan.priceARS) || 0;
    if (priceARS <= 0) return Response.json({ error: 'Este plan no tiene precio configurado' }, { status: 400 });

    const origin = new URL(request.url).origin;
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });

    if (plan.billingType === 'subscription') {
      const preapproval = new PreApproval(client);
      const result = await preapproval.create({
        body: {
          reason: `Lead Finder Pro — Plan ${plan.name}`,
          external_reference: `lfp:${user.uid}:${planId}`,
          payer_email: user.email,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: priceARS,
            currency_id: 'ARS',
          },
          back_url: `${origin}/mi-cuenta/?lfp=success`,
          status: 'pending',
        },
      });
      const initPoint = result?.init_point || result?.sandbox_init_point;
      if (!initPoint) return Response.json({ error: 'MercadoPago no devolvió init_point', raw: result }, { status: 502 });
      return Response.json({ initPoint, preapprovalId: result.id });
    }

    // billingType 'project' — pago único, acredita `credits` al aprobarse (payment-webhook)
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        external_reference: `LFP-${user.uid}-${planId}-${Date.now()}`,
        items: [{
          id: planId,
          title: `Lead Finder Pro — ${plan.name}`,
          description: plan.description || plan.name,
          category_id: 'services',
          unit_price: priceARS,
          quantity: 1,
        }],
        payer: { email: user.email },
        back_urls: {
          success: `${origin}/mi-cuenta/?lfp=success`,
          failure: `${origin}/mi-cuenta/?lfp=failure`,
          pending: `${origin}/mi-cuenta/?lfp=pending`,
        },
        auto_return: 'approved',
        metadata: { type: 'leadfinder_plan', uid: user.uid, planId, credits: Number(plan.credits) || 0 },
        notification_url: `${origin}/api/payment-webhook/`,
      },
    });
    if (!result?.init_point) return Response.json({ error: 'MercadoPago no devolvió init_point', raw: result }, { status: 502 });
    return Response.json({ initPoint: result.init_point });
  } catch (e) {
    console.error('[lead-finder-pro/subscribe] ERROR:', e?.message, e?.cause || '');
    return Response.json({ error: e?.message || 'Error creando el pago' }, { status: 500 });
  }
}
