export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

import { saveAuditoria } from '@/lib/auditoriasStore';

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

    // ?demo=1 — casos curados para la prueba gratuita de Lead Finder Pro (isDemoCase: true)
    if (searchParams.get('demo') === '1') {
      const snap = await db.collection('auditorias').where('isDemoCase', '==', true).limit(8).get();
      const list = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, title: data.title, config: data.config, stats: data.stats };
      });
      return Response.json(list);
    }

    const snap = await db.collection('auditorias').orderBy('publishedAt', 'desc').limit(50).get();
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title:       data.title,
        config:      data.config,
        stats:       data.stats,
        isDemoCase:  data.isDemoCase || false,
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
    const body = await request.json();
    const { title, config, results, stats, summary } = body;
    if (!title || !results?.length) {
      return Response.json({ error: 'title y results son requeridos' }, { status: 400 });
    }

    const { id } = await saveAuditoria({ title, config, results, stats, summary });
    return Response.json({ success: true, id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { id, title, summary, isDemoCase } = await request.json();
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });

    const update = {};
    if (typeof title === 'string')   update.title   = title.trim();
    if (typeof summary === 'string') update.summary = summary.trim();
    if (typeof isDemoCase === 'boolean') update.isDemoCase = isDemoCase;
    if (!Object.keys(update).length) {
      return Response.json({ error: 'Nada para actualizar (title, summary o isDemoCase)' }, { status: 400 });
    }
    update.updatedAt = FieldValue.serverTimestamp();

    await db.collection('auditorias').doc(id).update(update);
    return Response.json({ success: true });
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
