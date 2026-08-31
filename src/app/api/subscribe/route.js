export const dynamic = 'force-dynamic';

import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { PLANS, PAID_PLAN_IDS, CURRENCY } from '@/data/plans';

// POST /api/subscribe  { plan: 'basico' | 'full' }
// Crea una suscripción mensual automática (PreApproval) en MercadoPago y
// devuelve el init_point para redirigir al checkout.
// Requiere header Authorization: Bearer <idToken>.
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ error: 'Necesitás iniciar sesión' }, { status: 401 });
    }
    if (!user.email) {
      return Response.json({ error: 'Tu cuenta no tiene email asociado' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const planId = body?.plan;
    if (!PAID_PLAN_IDS.includes(planId)) {
      return Response.json({ error: 'Plan inválido' }, { status: 400 });
    }
    const plan = { ...PLANS[planId] };
    // Precio editable desde Admin > Planes > Analítica (Firestore analitica_plans) —
    // pisa el default de plans.js si hay un override guardado.
    try {
      const db = getDb();
      const ov = db ? (await db.collection('analitica_plans').doc(planId).get()).data() : null;
      if (ov?.price !== undefined) plan.price = ov.price;
    } catch { /* si falla, seguimos con el precio default */ }
    const origin = new URL(request.url).origin;

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const preapproval = new PreApproval(client);

    const result = await preapproval.create({
      body: {
        reason: `Analítica Pro — Plan ${plan.name}`,
        external_reference: `${user.uid}:${planId}`,
        payer_email: user.email,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: plan.price,
          currency_id: CURRENCY,
        },
        back_url: `${origin}/analitica/?sub=success`,
        status: 'pending',
      },
    });

    const initPoint = result?.init_point || result?.sandbox_init_point;
    if (!initPoint) {
      return Response.json({ error: 'MercadoPago no devolvió init_point', raw: result }, { status: 502 });
    }

    return Response.json({ initPoint, preapprovalId: result.id });
  } catch (e) {
    console.error('[subscribe] ERROR:', e?.message, e?.cause || '');
    return Response.json({ error: e?.message || 'Error creando la suscripción' }, { status: 500 });
  }
}
