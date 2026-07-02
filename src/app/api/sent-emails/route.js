export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';

// GET /api/sent-emails            → lista los últimos envíos
// GET /api/sent-emails?id=<docId> → un envío puntual (con el cuerpo completo)
export async function GET(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const doc = await db.collection('sent_emails').doc(id).get();
      if (!doc.exists) return Response.json({ error: 'No encontrado' }, { status: 404 });
      const d = doc.data();
      return Response.json({ id: doc.id, ...d, createdAt: d.createdAt?.toDate?.()?.toISOString() || null });
    }

    const snap = await db.collection('sent_emails').orderBy('createdAt', 'desc').limit(200).get();
    const list = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id:          doc.id,
        nombre:      d.nombre,
        email:       d.email,
        siteUrl:     d.siteUrl,
        ciudad:      d.ciudad,
        tipo:        d.tipo,
        seoScore:    d.seoScore,
        subject:     d.subject,
        body:        d.body,
        screenshotUrl: d.screenshotUrl,
        auditoriaId: d.auditoriaId,
        source:      d.source,
        resendId:    d.resendId,
        status:      d.status,
        createdAt:   d.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    return Response.json(list);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/sent-emails  body: { id }
export async function DELETE(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });
    await db.collection('sent_emails').doc(id).delete();
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
