export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

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
        toneInstructions: data.toneInstructions ?? null,
        // Tópicos creados antes de este campo no lo tienen: por default usan la foto del artículo.
        usarFoto: data.usarFoto !== false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    return Response.json({ topics });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

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
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const { id, activo, toneInstructions, usarFoto } = await request.json();
    if (!id) {
      return Response.json({ error: 'id es requerido' }, { status: 400 });
    }
    if (activo === undefined && toneInstructions === undefined && usarFoto === undefined) {
      return Response.json({ error: 'Nada para actualizar (activo, toneInstructions o usarFoto)' }, { status: 400 });
    }
    if (activo !== undefined && typeof activo !== 'boolean') {
      return Response.json({ error: 'activo debe ser boolean' }, { status: 400 });
    }
    if (usarFoto !== undefined && typeof usarFoto !== 'boolean') {
      return Response.json({ error: 'usarFoto debe ser boolean' }, { status: 400 });
    }
    if (toneInstructions !== undefined && typeof toneInstructions !== 'string') {
      return Response.json({ error: 'toneInstructions debe ser string' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const update = {};
    if (activo !== undefined) update.activo = activo;
    if (usarFoto !== undefined) update.usarFoto = usarFoto;
    if (toneInstructions !== undefined) update.toneInstructions = toneInstructions.trim() || null;

    await db.collection('noticias_topics').doc(id).update(update);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const { id } = await request.json();
    if (!id) {
      return Response.json({ error: 'id es requerido' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const topicRef = db.collection('noticias_topics').doc(id);
    const topicSnap = await topicRef.get();
    if (!topicSnap.exists) {
      return Response.json({ error: 'Tópico no encontrado' }, { status: 404 });
    }

    const notesSnap = await db.collection('noticias').where('topicId', '==', id).get();
    const docs = notesSnap.docs;

    const BATCH_LIMIT = 500;
    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const doc of docs.slice(i, i + BATCH_LIMIT)) {
        batch.delete(doc.ref);
      }
      await batch.commit();
    }

    await topicRef.delete();

    return Response.json({ success: true, deletedCount: docs.length });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
