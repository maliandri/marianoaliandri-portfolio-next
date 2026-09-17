export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const snap = await db.collection('noticias_topics').orderBy('createdAt', 'desc').get();
    const topics = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        label: data.label,
        query: data.query || data.label,
        activo: data.activo !== false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    return Response.json({ topics });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { label, query } = await request.json();
    if (!label || !label.trim()) {
      return Response.json({ error: 'label es requerido' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const docRef = await db.collection('noticias_topics').add({
      label: label.trim(),
      query: (query && query.trim()) || label.trim(),
      activo: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    return Response.json({
      success: true,
      topic: { id: docRef.id, label: label.trim(), query: (query && query.trim()) || label.trim(), activo: true },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id, activo } = await request.json();
    if (!id || typeof activo !== 'boolean') {
      return Response.json({ error: 'id y activo (boolean) son requeridos' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    await db.collection('noticias_topics').doc(id).update({ activo });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
