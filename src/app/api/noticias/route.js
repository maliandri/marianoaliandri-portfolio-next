export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';

export async function GET(request) {
  try {
    // ?public=1 lo usan superficies públicas (ej. NoticiasHome en el home) — solo
    // noticias publicadas y visibles en el sitio, sin el detalle interno de errores.
    // Sin el param es el log del admin (incluye las que fallaron y por qué, y las
    // notas de tópicos "solo X" que no van al sitio), así que exige login de admin:
    // antes era una API abierta que devolvía todo a cualquiera.
    const isPublic = new URL(request.url).searchParams.get('public') === '1';
    if (!isPublic) {
      const auth = await requireAdmin(request);
      if (auth.response) return auth.response;
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const snap = await db.collection('noticias').orderBy('publishedAt', 'desc').limit(150).get();
    let noticias = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        topicId: data.topicId || null,
        topicLabel: data.topicLabel || null,
        title: data.title || null,
        sourceUrl: data.sourceUrl || null,
        imageUrl: data.imageUrl || null,
        status: data.status || null,
        destino: data.destino || null,
        imageMode: data.imageMode || null,
        // Las notas de tópicos "solo X" se guardan con visibleEnSitio:false (el resto, sin el campo, se ven).
        visibleEnSitio: data.visibleEnSitio !== false,
        makeError: data.makeError || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      };
    });

    if (isPublic) {
      noticias = noticias
        .filter(n => n.status === 'published' && n.visibleEnSitio)
        .map(({ makeError, ...rest }) => rest);
    }

    return Response.json({ noticias });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
