export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { loadConfig } from '@/lib/autoAuditRun';
import { validateConfigPatch } from '@/lib/autoAudit';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { lock: _lock, ...config } = await loadConfig(db);
    const snap = await db.collection('auditoria_auto_runs').orderBy('createdAt', 'desc').limit(10).get();
    const runs = snap.docs.map(d => {
      const data = d.data();
      return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.()?.toISOString() || null };
    });
    return Response.json({ config, runs });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const body = await request.json();

    // Validate body before touching Firestore
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'Body inválido' }, { status: 400 });
    }

    const { update, error } = validateConfigPatch(body);
    if (error) return Response.json({ error }, { status: 400 });

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    await db.collection('auditoria_auto').doc('config').set(update, { merge: true });
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
