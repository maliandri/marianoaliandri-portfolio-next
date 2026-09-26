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

    // Dedupe: si este mismo email mandó los mismos servicios en los últimos 10 minutos
    // (doble clic, reintento de red, o el cliente resubmitiendo por las dudas), devolvemos
    // la solicitud ya creada en vez de guardar un duplicado. Filtramos solo por email
    // (single-field, no requiere índice compuesto) y el resto en memoria — el volumen por
    // cliente es siempre chico.
    const dedupeSinceMs = Date.now() - 10 * 60 * 1000;
    const recentSnap = await db.collection('presupuestos').where('clientEmail', '==', clientEmail).get();
    const sortedIncoming = [...selectedServices].sort().join(',');
    const dupe = recentSnap.docs.find(d => {
      const data = d.data();
      const createdMs = data.createdAt?.toMillis?.() ?? 0;
      return createdMs >= dedupeSinceMs && [...(data.selectedServices || [])].sort().join(',') === sortedIncoming;
    });
    if (dupe) {
      return Response.json({ success: true, budgetId: dupe.id, deduped: true });
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

    const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://marianoaliandri.com.ar';
    const emailPayload = {
      name: clientName,
      email: clientEmail,
      phone: clientPhone,
      company: clientCompany,
      message: projectDescription,
      services: selectedServices,
      deadline,
      budgetId: docRef.id,
    };

    // Notificar al admin y confirmar al cliente (en paralelo, sin bloquear)
    await Promise.allSettled([
      fetch(`${BASE}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'budget-received', ...emailPayload }),
      }),
      fetch(`${BASE}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'budget-confirmation', ...emailPayload }),
      }),
    ]);

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

export async function DELETE(request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });

    const db = getDb();
    if (!db) return Response.json({ error: 'Error de base de datos' }, { status: 500 });

    await db.collection('presupuestos').doc(id).delete();
    return Response.json({ success: true });
  } catch (error) {
    console.error('presupuesto DELETE error:', error);
    return Response.json({ error: 'Error al eliminar' }, { status: 500 });
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
