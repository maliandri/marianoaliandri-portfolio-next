export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const body = await request.json();
    const {
      clientName, clientEmail, clientCompany,
      items = [], totals, ivaRate, showIVA, arsRate,
      notes, quoteNumber, validDays,
      cuotas,
    } = body;

    if (!items.length) return Response.json({ error: 'Sin servicios seleccionados' }, { status: 400 });

    const selectedServices = items.map(i => i.id);

    const doc = {
      /* campos compatibles con BudgetManager (solicitudes) */
      clientName:         clientName || '',
      clientEmail:        clientEmail || '',
      clientCompany:      clientCompany || '',
      projectDescription: notes || '',
      selectedServices,
      status:             'pending',
      budgetUSD:          totals?.totalUSD ?? null,
      budgetARS:          totals?.totalARS ?? null,
      paymentLink:        null,
      paymentId:          null,
      adminNotes:         '',
      source:             'admin',   // distingue de los pedidos del formulario público

      /* campos extras del presupuestador */
      quoteNumber:  quoteNumber || '',
      validDays:    validDays   || 30,
      arsRate:      arsRate     || 1300,
      ivaRate:      ivaRate     || 21,
      showIVA:      showIVA     ?? true,
      items,        /* array completo con priceUSD y discount por item */
      totals,
      cuotas:       cuotas || null,

      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection('presupuestos').add(doc);
    console.log('[save-quote] guardado id:', ref.id);
    return Response.json({ success: true, id: ref.id });
  } catch (e) {
    console.error('[save-quote] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
