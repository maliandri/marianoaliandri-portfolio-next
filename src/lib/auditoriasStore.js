import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { callGemini } from '@/lib/geminiClient';

// Guarda una auditoría pública. Compartido por POST /api/auditorias (panel manual) y la
// auditoría automática. Email se guarda para uso admin; dirección y teléfono se descartan.
export async function saveAuditoria({ title, config, results, stats, summary: providedSummary, useGemini = true }) {
  const db = getDb();
  if (!db) throw new Error('DB no disponible');

  const storedResults = results.map(r => ({
    id:           r.id,
    nombre:       r.nombre,
    ciudad:       r.ciudad   || null,
    tipo:         r.tipo,
    rubro:        r.rubro    || null,
    aptoSistemaMedida: r.aptoSistemaMedida === true,
    lat:          r.lat ?? null,
    lon:          r.lon ?? null,
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

  // Resumen del reporte: usar el texto editado si vino; si no, Gemini; si falla, plantilla.
  const ciudades  = (config?.ciudades || []).join(', ') || 'la zona analizada';
  const tipos     = (config?.tiposLabels || []).slice(0, 8).join(', ');
  const total     = stats?.total ?? storedResults.length;
  const lowSeo    = stats?.lowSeoCount ?? 0;
  const avg       = stats?.avgSeoScore ?? '—';
  const withEmail = stats?.withEmail ?? 0;
  const pctLow    = total > 0 ? Math.round(lowSeo / total * 100) : 0;

  let summary = (providedSummary && providedSummary.trim()) ? providedSummary.trim() : null;
  if (!summary) {
    if (useGemini !== false) try {
      summary = await callGemini(
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
    } catch {
      summary = null;
    }
    if (!summary) {
      summary = `Auditoría SEO de ${total} negocios con sitio web propio en ${ciudades}. El ${pctLow}% (${lowSeo}) tiene un posicionamiento web débil (score menor a 50) y el promedio general es ${avg}/100. ${withEmail} cuentan con un email público de contacto. El relevamiento evidencia oportunidades concretas de mejora en la presencia digital de los comercios de la zona: sitios sin sitemap, sin metadatos o desactualizados, que hoy pierden posiciones en Google frente a la competencia.`;
    }
  }

  const docRef = await db.collection('auditorias').add({
    title,
    config,
    results: storedResults,
    stats,
    summary,
    publishedAt: FieldValue.serverTimestamp(),
    createdAt:   FieldValue.serverTimestamp(),
  });

  return { id: docRef.id, summary };
}
