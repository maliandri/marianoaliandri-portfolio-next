export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';
import { PLANS } from '@/data/plans';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Los planes de Analítica (free/basico/full) son ids FIJOS -- los usan
// /api/subscribe, /api/subscription-webhook y lib/entitlements.js para
// matchear la suscripción real de MercadoPago. Esta ruta solo permite
// editar precio y límite de esos 3 ids, nunca crear/borrar planes nuevos.
const EDITABLE_IDS = ['free', 'basico', 'full'];

// GET público — planes efectivos (default de plans.js + override guardado en Firestore)
export async function GET() {
  try {
    const db = getDb();
    const overrides = {};
    if (db) {
      const snap = await db.collection('analitica_plans').get();
      snap.forEach(doc => { overrides[doc.id] = doc.data(); });
    }

    const plans = EDITABLE_IDS.map(id => {
      const base = PLANS[id];
      const ov = overrides[id] || {};
      return {
        id,
        name: base.name,
        features: base.features,
        period: base.period,
        price: ov.price ?? base.price,
        limit: ov.limit !== undefined ? ov.limit : base.limit, // null = ilimitado
      };
    });

    return Response.json({ plans });
  } catch (error) {
    return Response.json({ error: 'Error obteniendo planes', details: error.message }, { status: 500 });
  }
}

// POST admin-only — actualiza precio/límite de un plan existente (id fijo)
export async function POST(request) {
  try {
    const { adminPassword, id, price, limit } = await request.json();
    if (adminPassword !== ADMIN_PASSWORD || !ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!EDITABLE_IDS.includes(id)) {
      return Response.json({ error: `id inválido — solo se puede editar: ${EDITABLE_IDS.join(', ')}` }, { status: 400 });
    }

    const db = getDb();
    await db.collection('analitica_plans').doc(id).set(
      {
        price: Number(price) || 0,
        limit: limit === null || limit === '' ? null : Number(limit),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Error guardando plan', details: error.message }, { status: 500 });
  }
}
