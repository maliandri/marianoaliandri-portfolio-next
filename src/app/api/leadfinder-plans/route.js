export const dynamic = 'force-dynamic';

import admin, { getDb } from '@/lib/firebase-admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function checkAuth(adminPassword) {
  return adminPassword === ADMIN_PASSWORD && !!ADMIN_PASSWORD;
}

// GET — lista pública de planes activos (?all=1 para el admin, incluye inactivos)
export async function GET(request) {
  try {
    const showAll = new URL(request.url).searchParams.get('all') === '1';
    const db = getDb();
    if (!db) return Response.json({ plans: [] });

    const snap = await db.collection('leadfinder_plans').get();
    let plans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (!showAll) plans = plans.filter(p => p.active !== false);
    plans.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

    return Response.json({ plans });
  } catch (error) {
    return Response.json({ error: 'Error obteniendo planes', details: error.message }, { status: 500 });
  }
}

// POST — crear plan nuevo
export async function POST(request) {
  try {
    const { adminPassword, plan } = await request.json();
    if (!checkAuth(adminPassword)) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (!plan?.name) return Response.json({ error: 'El plan necesita un nombre' }, { status: 400 });

    const db = getDb();
    const ref = await db.collection('leadfinder_plans').add({
      name: plan.name,
      scope: plan.scope || 'localidad',
      billingType: plan.billingType || 'subscription',
      priceARS: Number(plan.priceARS) || 0,
      credits: Number(plan.credits) || 0,
      description: plan.description || '',
      active: plan.active !== false,
      order: Number(plan.order) || 99,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return Response.json({ success: true, id: ref.id });
  } catch (error) {
    return Response.json({ error: 'Error creando plan', details: error.message }, { status: 500 });
  }
}

// PATCH — editar plan existente (id + campos a actualizar)
export async function PATCH(request) {
  try {
    const { adminPassword, id, plan } = await request.json();
    if (!checkAuth(adminPassword)) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });

    const db = getDb();
    await db.collection('leadfinder_plans').doc(id).set(
      {
        name: plan.name,
        scope: plan.scope,
        billingType: plan.billingType,
        priceARS: Number(plan.priceARS) || 0,
        credits: Number(plan.credits) || 0,
        description: plan.description || '',
        active: plan.active !== false,
        order: Number(plan.order) || 99,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Error guardando plan', details: error.message }, { status: 500 });
  }
}

// DELETE — baja definitiva (?id=&adminPassword=)
export async function DELETE(request) {
  try {
    const params = new URL(request.url).searchParams;
    const id = params.get('id');
    const adminPassword = params.get('adminPassword');
    if (!checkAuth(adminPassword)) return Response.json({ error: 'No autorizado' }, { status: 401 });
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });

    const db = getDb();
    await db.collection('leadfinder_plans').doc(id).delete();

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Error eliminando plan', details: error.message }, { status: 500 });
  }
}
