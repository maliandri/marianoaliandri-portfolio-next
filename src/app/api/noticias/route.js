export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const snap = await db.collection('noticias').orderBy('publishedAt', 'desc').limit(50).get();
    const noticias = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        topicLabel: data.topicLabel || null,
        title: data.title || null,
        sourceUrl: data.sourceUrl || null,
        imageUrl: data.imageUrl || null,
        status: data.status || null,
        makeError: data.makeError || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      };
    });
    return Response.json({ noticias });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
