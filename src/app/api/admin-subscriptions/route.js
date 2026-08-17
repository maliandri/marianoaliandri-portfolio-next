export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { PLANS } from '@/data/plans';

// Lista las suscripciones (coleccion "entitlements") con datos de usuario (coleccion "users")
// para mostrarlas en el panel Admin. Solo lectura — el plan/cuota siguen siendo
// escritos exclusivamente por el Admin SDK (ver src/lib/entitlements.js).
export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const [entitlementsSnap, usersSnap] = await Promise.all([
      db.collection('entitlements').get(),
      db.collection('users').get(),
    ]);

    const usersById = {};
    usersSnap.forEach(doc => { usersById[doc.id] = doc.data(); });

    const subscriptions = [];
    let mrr = 0;
    let activePaid = 0;

    entitlementsSnap.forEach(doc => {
      const e = doc.data();
      const user = usersById[doc.id] || {};
      const plan = e.plan || 'free';
      const planDef = PLANS[plan] || PLANS.free;
      const isActivePaid = plan !== 'free' && e.planStatus === 'active';

      if (isActivePaid) {
        activePaid += 1;
        mrr += planDef.price || 0;
      }

      subscriptions.push({
        uid: doc.id,
        displayName: user.displayName || null,
        email: user.email || null,
        plan,
        planName: planDef.name,
        planPrice: planDef.price || 0,
        planStatus: e.planStatus || 'active',
        mpPreapprovalId: e.mpPreapprovalId || null,
        planRenewsAt: e.planRenewsAt || null,
        usagePeriod: e.usagePeriod || null,
        usageCount: e.usageCount || 0,
        usageLimit: planDef.limit,
        updatedAt: e.updatedAt || null,
      });
    });

    // Suscripciones pagas (activas o no) primero, ordenadas por actualización reciente.
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
