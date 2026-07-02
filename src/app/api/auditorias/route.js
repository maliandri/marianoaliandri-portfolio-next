export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(25000),
    });
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch { return null; }
}

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

    const snap = await db.collection('auditorias').orderBy('publishedAt', 'desc').limit(50).get();
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title:       data.title,
        config:      data.config,
        stats:       data.stats,
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
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const body = await request.json();
    const { title, config, results, stats } = body;
    if (!title || !results?.length) {
      return Response.json({ error: 'title y results son requeridos' }, { status: 400 });
    }

    // Guardar resultados — email se mantiene para uso admin, dirección y teléfono se descartan
    const storedResults = results.map(r => ({
      id:           r.id,
      nombre:       r.nombre,
      ciudad:       r.ciudad   || null,
      tipo:         r.tipo,
      siteUrl:      r.siteUrl,
      email:        r.email    || null,   // se guarda para envío admin, no se muestra en página pública
      seoScore:     r.seoScore,
      hasSitemap:   r.hasSitemap,
      hasRobots:    r.hasRobots,
      metaDesc:     r.metaDesc ? true : r.metaDesc === null ? null : false,
      hasOG:        r.hasOG,
      lastModified: r.lastModified || null,
      rating:       r.rating   || null,
    }));

    // Generar resumen Gemini para el reporte público
    const ciudades  = (config?.ciudades || []).join(', ') || 'la zona analizada';
    const tipos     = (config?.tiposLabels || []).slice(0, 8).join(', ');
    const total     = stats?.total ?? storedResults.length;
    const lowSeo    = stats?.lowSeoCount ?? 0;
    const avg       = stats?.avgSeoScore ?? '—';
    const withEmail = stats?.withEmail ?? 0;
    const pctLow    = total > 0 ? Math.round(lowSeo / total * 100) : 0;

    const summary = await callGemini(
      `Sos un analista de presencia digital argentina. Escribí un texto de 4 a 5 oraciones en español rioplatense (vos, no tú) que resuma los resultados de esta auditoría SEO de negocios locales con sitio web propio.

Datos:
- Ciudades: ${ciudades}
- Tipos de negocio: ${tipos}
- Total de sitios auditados: ${total}
- Score SEO promedio: ${avg}/100
- Sitios con SEO débil (< 50): ${lowSeo} (${pctLow}%)
- Con email público: ${withEmail}

El texto debe explicar qué significa un SEO débil para un negocio local, destacar la oportunidad de mejora en la zona, sonar profesional y accesible. Sin listas ni bullets, solo prosa corrida. Sin precios ni publicidad directa.`
    );

    const docRef = await db.collection('auditorias').add({
      title,
      config,
      results: storedResults,
      stats,
      summary: summary || null,
      publishedAt: FieldValue.serverTimestamp(),
      createdAt:   FieldValue.serverTimestamp(),
    });

    return Response.json({ success: true, id: docRef.id });
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
