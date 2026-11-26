export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

import { saveAuditoria } from '@/lib/auditoriasStore';
import { requireAdmin } from '@/lib/adminAuth';
import { asegurarClave } from '@/lib/auditClave';

// Campos de cada negocio que puede ver alguien sin sesión de admin (los casos demo de Lead Finder
// Pro). Nunca email, WhatsApp ni señales comerciales.
const PUBLIC_RESULT_FIELDS = ['id', 'nombre', 'ciudad', 'tipo', 'siteUrl', 'seoScore', 'hasSitemap', 'hasRobots', 'metaDesc', 'hasOG', 'lastModified', 'rating', 'lat', 'lon'];
const publicResult = (r) => Object.fromEntries(PUBLIC_RESULT_FIELDS.map(k => [k, r?.[k] ?? null]));

// Lectura: el detalle completo (con emails y WhatsApp) y el listado son solo para el admin desde
// 2026-11-26 (las auditorías dejaron de ser un listado público). Sin sesión de admin solo se
// pueden leer los casos demo (isDemoCase), sin datos de contacto.
export async function GET(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const isDemo = searchParams.get('demo') === '1';
    const { response: noAdmin } = isDemo ? { response: true } : await requireAdmin(request);

    if (id) {
      const doc = await db.collection('auditorias').doc(id).get();
      if (!doc.exists) return Response.json({ error: 'No encontrado' }, { status: 404 });
      const data = doc.data();
      if (noAdmin) {
        if (!data.isDemoCase) return Response.json({ error: 'No encontrado' }, { status: 404 });
        return Response.json({
          id: doc.id, title: data.title, config: data.config, stats: data.stats, summary: data.summary || null,
          results: (data.results || []).map(publicResult),
          publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
        });
      }
      const clave = await asegurarClave(db, doc.id, data);
      return Response.json({
        id: doc.id,
        ...data,
        clave,
        createdAt:   data.createdAt?.toDate?.()?.toISOString()   || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      });
    }

    // ?demo=1 — casos curados para la prueba gratuita de Lead Finder Pro (isDemoCase: true)
    if (isDemo) {
      const snap = await db.collection('auditorias').where('isDemoCase', '==', true).limit(8).get();
      const list = snap.docs.map(d => {
        const data = d.data();
        return { id: d.id, title: data.title, config: data.config, stats: data.stats };
      });
      return Response.json(list);
    }

    if (noAdmin) return noAdmin;
    const snap = await db.collection('auditorias').orderBy('publishedAt', 'desc').limit(50).get();
    const list = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      return {
        id: d.id,
        title:       data.title,
        config:      data.config,
        stats:       data.stats,
        isDemoCase:  data.isDemoCase || false,
        clave:       await asegurarClave(db, d.id, data),
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      };
    }));
    return Response.json(list);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Escrituras: solo la cuenta admin (antes cualquiera podía crear o borrar informes públicos).
export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  try {
    const body = await request.json();
    const { title, config, results, stats, summary } = body;
    if (!title || !results?.length) {
      return Response.json({ error: 'title y results son requeridos' }, { status: 400 });
    }

    const { id, clave } = await saveAuditoria({ title, config, results, stats, summary });
    return Response.json({ success: true, id, clave });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
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
  const { response } = await requireAdmin(request);
  if (response) return response;
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
