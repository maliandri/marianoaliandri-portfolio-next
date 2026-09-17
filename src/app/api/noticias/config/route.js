export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';

const DEFAULTS = { active: true, dailyCap: null };

export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const doc = await db.collection('noticias_config').doc('settings').get();
    if (!doc.exists) return Response.json(DEFAULTS);

    const data = doc.data();
    return Response.json({
      active: data.active !== false,
      dailyCap: data.dailyCap ?? null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const update = {};
    if ('active' in body) {
      if (typeof body.active !== 'boolean') return Response.json({ error: 'active debe ser boolean' }, { status: 400 });
      update.active = body.active;
    }
    if ('dailyCap' in body) {
      if (body.dailyCap !== null && (typeof body.dailyCap !== 'number' || body.dailyCap < 1)) {
        return Response.json({ error: 'dailyCap debe ser null o un número >= 1' }, { status: 400 });
      }
      update.dailyCap = body.dailyCap;
    }
    if (!Object.keys(update).length) {
      return Response.json({ error: 'Nada para actualizar (active o dailyCap)' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    await db.collection('noticias_config').doc('settings').set(update, { merge: true });

    const doc = await db.collection('noticias_config').doc('settings').get();
    const data = doc.data();
    return Response.json({ success: true, active: data.active !== false, dailyCap: data.dailyCap ?? null });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
