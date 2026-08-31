import { getDb } from '@/lib/firebase-admin';

const RENTAL_DATA = {
  'landing-page':       { seña: 150, cuota: 55,  duracionMinima: 6, activo: true },
  'business-website':   { seña: 350, cuota: 120, duracionMinima: 6, activo: true },
  'ecommerce':          { seña: 550, cuota: 195, duracionMinima: 6, activo: true },
  'ai-chatbot-website': { seña: 450, cuota: 160, duracionMinima: 6, activo: true },
  'powerbi-dashboard':  { seña: 300, cuota: 105, duracionMinima: 6, activo: true },
  'roi-consulting':     { seña: 200, cuota: 70,  duracionMinima: 6, activo: true },
};

export async function POST(request) {
  try {
    const db = getDb();
    if (!db) {
      return Response.json({ error: 'Firebase Admin no disponible' }, { status: 500 });
    }

    const batch = db.batch();
    for (const [id, data] of Object.entries(RENTAL_DATA)) {
      const ref = db.collection('productos_alquiler').doc(id);
      batch.set(ref, { productoId: id, ...data }, { merge: true });
    }
    await batch.commit();

    return Response.json({
      ok: true,
      message: `Seeded ${Object.keys(RENTAL_DATA).length} documentos en productos_alquiler`,
      ids: Object.keys(RENTAL_DATA),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
