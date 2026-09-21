export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/adminAuth';

// Mismos valores que networksFor() en scripts/noticias-bot.mjs (el bot no puede importar de src/).
const DESTINOS = ['fb_ig', 'linkedin', 'todas', 'x'];

// Tope de notas por corrida de cada tópico: mismo default (2) y máximo (5) que
// itemsPerRunFor() en scripts/noticias-bot.mjs.
const DEFAULT_MAX_POR_CORRIDA = 2;
const ABSOLUTE_MAX_POR_CORRIDA = 5;
const isValidMaxPorCorrida = n => Number.isInteger(n) && n >= 1 && n <= ABSOLUTE_MAX_POR_CORRIDA;
const normalizeMaxPorCorrida = n =>
  Number.isInteger(n) && n >= 1 ? Math.min(n, ABSOLUTE_MAX_POR_CORRIDA) : DEFAULT_MAX_POR_CORRIDA;

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
        // Dónde se publica: 'fb_ig' (default, como siempre), 'linkedin' (solo LinkedIn), 'todas'
        // o 'x' (solo X, y esas notas NO se muestran en el sitio).
        destino: DESTINOS.includes(data.destino) ? data.destino : 'fb_ig',
        maxPorCorrida: normalizeMaxPorCorrida(data.maxPorCorrida),
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
    const { id, activo, toneInstructions, usarFoto, destino, maxPorCorrida, query } = await request.json();
    if (!id) {
      return Response.json({ error: 'id es requerido' }, { status: 400 });
    }
    if (
      activo === undefined && toneInstructions === undefined && usarFoto === undefined &&
      destino === undefined && maxPorCorrida === undefined && query === undefined
    ) {
      return Response.json({ error: 'Nada para actualizar (activo, toneInstructions, usarFoto, destino, maxPorCorrida o query)' }, { status: 400 });
    }
    if (maxPorCorrida !== undefined && !isValidMaxPorCorrida(maxPorCorrida)) {
      return Response.json({ error: `maxPorCorrida debe ser un entero de 1 a ${ABSOLUTE_MAX_POR_CORRIDA}` }, { status: 400 });
    }
    if (destino !== undefined && !DESTINOS.includes(destino)) {
      return Response.json({ error: `destino debe ser uno de: ${DESTINOS.join(', ')}` }, { status: 400 });
    }
    if (activo !== undefined && typeof activo !== 'boolean') {
      return Response.json({ error: 'activo debe ser boolean' }, { status: 400 });
    }
    if (usarFoto !== undefined && typeof usarFoto !== 'boolean') {
      return Response.json({ error: 'usarFoto debe ser boolean' }, { status: 400 });
    }
    if (query !== undefined && (typeof query !== 'string' || !query.trim() || query.length > 200)) {
      return Response.json({ error: 'query debe ser un texto de 1 a 200 caracteres' }, { status: 400 });
    }
    if (toneInstructions !== undefined && typeof toneInstructions !== 'string') {
      return Response.json({ error: 'toneInstructions debe ser string' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const update = {};
    if (activo !== undefined) update.activo = activo;
    if (usarFoto !== undefined) update.usarFoto = usarFoto;
    if (destino !== undefined) update.destino = destino;
    if (maxPorCorrida !== undefined) update.maxPorCorrida = maxPorCorrida;
    if (query !== undefined) update.query = query.trim();
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
