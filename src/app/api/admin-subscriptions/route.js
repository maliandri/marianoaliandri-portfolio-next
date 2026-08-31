export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { PLANS } from '@/data/plans';

function monthKey(d = new Date()) { return d.toISOString().slice(0, 7); }

// Lista las suscripciones/planes activos de AMBOS productos (Analítica en "entitlements",
// Lead Finder Pro en "leadfinder_entitlements") para mostrarlas juntas en un solo panel
// Admin. Solo lectura — el plan/cuota/créditos siguen siendo escritos exclusivamente por
// el Admin SDK (webhooks de MercadoPago, ver /api/subscription-webhook y /api/payment-webhook).
export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const [entitlementsSnap, leadfinderSnap, usersSnap, leadfinderPlansSnap] = await Promise.all([
      db.collection('entitlements').get(),
      db.collection('leadfinder_entitlements').get(),
      db.collection('users').get(),
      db.collection('leadfinder_plans').get(),
    ]);

    const usersById = {};
    usersSnap.forEach(doc => { usersById[doc.id] = doc.data(); });
    const leadfinderPlansById = {};
    leadfinderPlansSnap.forEach(doc => { leadfinderPlansById[doc.id] = doc.data(); });

    const subscriptions = [];
    let mrr = 0;
    let activePaid = 0;
    const mk = monthKey();

    // --- Analítica Regional ---
    entitlementsSnap.forEach(doc => {
      const e = doc.data();
      const user = usersById[doc.id] || {};
      const plan = e.plan || 'free';
      const planDef = PLANS[plan] || PLANS.free;
      const isActivePaid = plan !== 'free' && e.planStatus === 'active';
      if (isActivePaid) { activePaid += 1; mrr += planDef.price || 0; }

      subscriptions.push({
        uid: doc.id,
        product: 'Analítica',
        displayName: user.displayName || null,
        email: user.email || null,
        plan,
        planName: planDef.name,
        planPrice: planDef.price || 0,
        billingType: 'subscription',
        status: e.planStatus || 'active',
        usageLabel: (planDef.limit === null ? `${e.usageCount || 0} (ilimitado)` : `${e.usagePeriod === mk ? (e.usageCount || 0) : 0}/${planDef.limit}`),
        renewsAt: e.planRenewsAt || null,
        updatedAt: e.updatedAt || null,
      });
    });

    // --- Lead Finder Pro ---
    leadfinderSnap.forEach(doc => {
      const e = doc.data();
      const user = usersById[doc.id] || {};

      if (e.unlimited === true) {
        subscriptions.push({
          uid: doc.id,
          product: 'Lead Finder Pro',
          displayName: user.displayName || null,
          email: user.email || null,
          plan: 'comped',
          planName: '🎁 Cortesía (comped)',
          planPrice: 0,
          billingType: 'comped',
          status: e.status || 'active',
          usageLabel: `${e.auditCount || 0} auditorías (ilimitado)`,
          renewsAt: null,
          updatedAt: e.updatedAt || null,
        });
        return;
      }

      if (e.billingType === 'subscription' && e.planId) {
        const planDef = leadfinderPlansById[e.planId] || {};
        const isActivePaid = e.status === 'active';
        if (isActivePaid) { activePaid += 1; mrr += Number(planDef.priceARS) || 0; }
        const used = e.usagePeriod === mk ? (e.usageCount || 0) : 0;
        subscriptions.push({
          uid: doc.id,
          product: 'Lead Finder Pro',
          displayName: user.displayName || null,
          email: user.email || null,
          plan: e.planId,
          planName: e.planName || planDef.name || e.planId,
          planPrice: Number(planDef.priceARS) || 0,
          billingType: 'subscription',
          status: e.status || 'pending',
          usageLabel: `${used}/${e.planCredits || 0}`,
          renewsAt: e.renewsAt || null,
          updatedAt: e.updatedAt || null,
        });
      } else if ((e.credits || 0) > 0 || e.billingType === 'project') {
        subscriptions.push({
          uid: doc.id,
          product: 'Lead Finder Pro',
          displayName: user.displayName || null,
          email: user.email || null,
          plan: e.planId || 'project',
          planName: 'Pago único',
          planPrice: 0,
          billingType: 'project',
          status: (e.credits || 0) > 0 ? 'active' : 'agotado',
          usageLabel: `${e.credits || 0} créditos restantes`,
          renewsAt: null,
          updatedAt: e.updatedAt || null,
        });
      }
    });

    subscriptions.sort((a, b) => {
      const aPaid = a.plan !== 'free' ? 1 : 0;
      const bPaid = b.plan !== 'free' ? 1 : 0;
      if (aPaid !== bPaid) return bPaid - aPaid;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

    const stats = {
      total: subscriptions.length,
      activePaid,
      mrr,
      byPlan: subscriptions.reduce((acc, s) => {
        acc[s.plan] = (acc[s.plan] || 0) + 1;
        return acc;
      }, {}),
    };

    return Response.json({ subscriptions, stats });
  } catch (error) {
    console.error('[admin-subscriptions] ERROR:', error?.message);
    return Response.json({ error: error?.message }, { status: 500 });
  }
}
