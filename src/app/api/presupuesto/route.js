export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request) {
  try {
    const body = await request.json();
    const { clientName, clientEmail, clientPhone, clientCompany, projectDescription, deadline, selectedServices } = body;

    if (!clientName || !clientEmail || !selectedServices?.length) {
      return Response.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const db = getDb();
    if (!db) {
      return Response.json({ error: 'Error de base de datos' }, { status: 500 });
    }

    const docRef = await db.collection('presupuestos').add({
      clientName,
      clientEmail,
      clientPhone: clientPhone || '',
      clientCompany: clientCompany || '',
      projectDescription: projectDescription || '',
      deadline: deadline || '',
      selectedServices,
      status: 'pending',
      budgetUSD: null,
      budgetARS: null,
      paymentLink: null,
      paymentId: null,
      adminNotes: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Notificar al admin por email
    try {
      await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://marianoaliandri.com.ar'}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'budget-received',
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
          company: clientCompany,
          message: projectDescription,
          services: selectedServices,
          deadline,
          budgetId: docRef.id,
        }),
      });
    } catch {
      // No bloquear si el email falla
    }

    return Response.json({ success: true, budgetId: docRef.id });
  } catch (error) {
    console.error('presupuesto error:', error);
    return Response.json({ error: 'Error al guardar el presupuesto' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { budgetId, ...updates } = await request.json();
    if (!budgetId) return Response.json({ error: 'budgetId requerido' }, { status: 400 });

    const db = getDb();
    if (!db) return Response.json({ error: 'Error de base de datos' }, { status: 500 });

    await db.collection('presupuestos').doc(budgetId).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('presupuesto PATCH error:', error);
    return Response.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'Error de base de datos' }, { status: 500 });

    const snap = await db.collection('presupuestos').orderBy('createdAt', 'desc').limit(100).get();
    const presupuestos = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: d.data().updatedAt?.toDate?.()?.toISOString() || null,
    }));

    return Response.json(presupuestos);
  } catch (error) {
    console.error('presupuesto GET error:', error);
    return Response.json({ error: 'Error al obtener presupuestos' }, { status: 500 });
  }
}
