export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { getDb } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    const { domain, url, type } = await request.json();
    if (!domain || !url || !type) {
      return Response.json({ error: 'domain, url y type son requeridos' }, { status: 400 });
    }
    if (type !== 'image' && type !== 'video') {
      return Response.json({ error: 'type debe ser "image" o "video"' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'Firestore no disponible' }, { status: 500 });

    const docRef = db.collection('proyectos').doc(domain);
    const snap = await docRef.get();
    const existingMedia = snap.data()?.media || [];

    const item = {
      id: crypto.randomUUID(),
      url,
      type,
      publicable: true,
      uploadedAt: Date.now(),
    };
    const media = [...existingMedia, item];

    await docRef.set({ media }, { merge: true });

    return Response.json({ success: true, media });
  } catch (error) {
    return Response.json({ error: 'Error subiendo medio', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { domain, mediaId, publicable } = await request.json();
    if (!domain || !mediaId || typeof publicable !== 'boolean') {
      return Response.json({ error: 'domain, mediaId y publicable (boolean) son requeridos' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'Firestore no disponible' }, { status: 500 });

    const docRef = db.collection('proyectos').doc(domain);
    const snap = await docRef.get();
    const existingMedia = snap.data()?.media || [];

    if (!existingMedia.some(m => m.id === mediaId)) {
      return Response.json({ error: `No se encontró el medio ${mediaId}` }, { status: 400 });
    }

    const media = existingMedia.map(m => (m.id === mediaId ? { ...m, publicable } : m));
    await docRef.set({ media }, { merge: true });

    return Response.json({ success: true, media });
  } catch (error) {
    return Response.json({ error: 'Error actualizando medio', details: error.message }, { status: 500 });
  }
}
