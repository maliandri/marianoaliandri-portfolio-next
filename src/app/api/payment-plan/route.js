export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';
import { DEFAULT_PAYMENT_PLAN, sanitizePlan } from '@/data/paymentPlan';
import { requireAdmin } from '@/lib/adminAuth';

// GET público: devuelve el plan de pago vigente (override de Firestore o default).
export async function GET() {
  try {
    const db = getDb();
    const snap = await db.collection('site_config').doc('payment_plan').get();
    if (snap.exists) {
      return Response.json({ plan: sanitizePlan(snap.data()) });
    }
  } catch (e) {
    // si falla Firestore, devolvemos el default
    console.error('payment-plan GET:', e.message);
  }
  return Response.json({ plan: DEFAULT_PAYMENT_PLAN });
}

// POST admin: guarda un nuevo plan.
// La seña (primer hito) es lo que cobra la tienda /tienda en modo "seña".
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const { plan } = await request.json();
    const clean = sanitizePlan(plan);
    const db = getDb();
    await db.collection('site_config').doc('payment_plan').set({
      ...clean,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return Response.json({ success: true, plan: clean });
  } catch (error) {
    return Response.json({ error: 'Error guardando el plan', message: error.message }, { status: 500 });
  }
}
