export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const trendsDoc = await db.collection('analytics_cache').doc('trends').get();

    const trends = trendsDoc.exists ? {
      ...trendsDoc.data(),
      updatedAt: trendsDoc.data().updatedAt?.toDate?.()?.toISOString() || null,
    } : null;

    return Response.json({ trends });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
