export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const doc = await db.collection('auditorias').doc(id).get();
      if (!doc.exists) return Response.json({ error: 'No encontrado' }, { status: 404 });
      const data = doc.data();
      return Response.json({
        id: doc.id,
        ...data,
        createdAt:   data.createdAt?.toDate?.()?.toISOString()   || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      });
    }

    const snap = await db.collection('auditorias').orderBy('publishedAt', 'desc').limit(50).get();
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title:       data.title,
        config:      data.config,
        stats:       data.stats,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      };
    });
    return Response.json(list);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const body = await request.json();
    const { title, config, results, stats } = body;
    if (!title || !results?.length) {
      return Response.json({ error: 'title y results son requeridos' }, { status: 400 });
    }

    const docRef = await db.collection('auditorias').add({
      title,
      config,
      results,
      stats,
      publishedAt: FieldValue.serverTimestamp(),
      createdAt:   FieldValue.serverTimestamp(),
    });

    return Response.json({ success: true, id: docRef.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });

    await db.collection('auditorias').doc(id).delete();
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
