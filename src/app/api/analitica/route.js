export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const [trendsDoc, auditSnap] = await Promise.all([
      db.collection('analytics_cache').doc('trends').get(),
      db.collection('auditorias').orderBy('createdAt', 'desc').limit(20).get(),
    ]);

    const trends = trendsDoc.exists ? {
      ...trendsDoc.data(),
      updatedAt: trendsDoc.data().updatedAt?.toDate?.()?.toISOString() || null,
    } : null;

    const auditorias = auditSnap.docs.map(d => {
      const data = d.data();
      return {
        id:          d.id,
        title:       data.title,
        summary:     data.summary,
        stats:       data.stats,
        config:      data.config,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
        createdAt:   data.createdAt?.toDate?.()?.toISOString()   || null,
        hasMap:      (data.results || []).some(r => typeof r.lat === 'number'),
      };
    });

    return Response.json({ trends, auditorias });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
