import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';
import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';
import AuditTable from './AuditTable';
import AuditMapLoader from './AuditMapLoader';
import AuditRequestForm from '@/components/audit/AuditRequestForm';
import AuditPdfButton from '@/components/audit/AuditPdfButton';
import SeoScoreChart from './SeoScoreChart';

// ISR on-demand: cada informe se genera en su primera visita y queda en el CDN.
// /api/auditorias lo invalida si se edita o se borra.
export const revalidate = 86400;
// Sin páginas en el build: lista vacía = cada una se genera en su primera visita
// y queda cacheada (sin esto Next las renderiza en cada request).
export async function generateStaticParams() { return []; }

// Dominios verificados en GSC = sitios del portfolio de Mariano (para destacarlos)
async function getOwnDomains() {
  try {
    const sites = await getVerifiedSites(getGSCAuth());
    return sites.map(s => s.domain.toLowerCase());
  } catch {
    return [];
  }
}

// cache(): generateMetadata y la página comparten una sola lectura de Firestore.
// Un error se propaga (no se cachea un 404 falso); Next conserva la versión anterior.
const getAuditoria = cache(async (id) => {
  const db = getDb();
  if (!db) return null;
  const doc = await db.collection('auditorias').doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
    createdAt:   data.createdAt?.toDate?.()?.toISOString()   || null,
  };
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const a = await getAuditoria(id);
  if (!a) return { title: 'Auditoría no encontrada' };
  const url = `https://marianoaliandri.com.ar/auditorias/${id}`;
  const desc = `Reporte SEO de ${a.stats?.total} sitios web en ${(a.config?.ciudades || []).join(', ')}.`;
  return {
    title: `${a.title} | Auditorías Web`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: `${a.title} | Auditorías Web`,
      description: desc,
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: a.title }],
    },
  };
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function AuditoriaDetailPage({ params }) {
  const { id } = await params;
  const a = await getAuditoria(id);
  if (!a) notFound();

  // Solo los campos que muestran la tabla, el mapa y el PDF: lo que se pasa a un componente de
  // cliente viaja entero en el HTML. Nunca el email ni las señales comerciales (agencia, anuncios).
  const results     = (a.results || []).map(({ id, nombre, ciudad, tipo, siteUrl, seoScore, hasSitemap, hasRobots, metaDesc, hasOG, lastModified, rating, lat, lon }) =>
    ({ id, nombre, ciudad, tipo, siteUrl, seoScore, hasSitemap, hasRobots, metaDesc, hasOG, lastModified, rating, lat, lon }));
  const ciudades    = a.config?.ciudades || [];
  const ownDomains  = await getOwnDomains();
  const hasOwnSite  = ownDomains.length > 0 && results.some(r => {
    try {
      const h = new URL(r.siteUrl).hostname.replace(/^www\./, '').toLowerCase();
      return ownDomains.some(d => h === d || h.endsWith('.' + d));
    } catch { return false; }
  });

  // Distribución de Score SEO (mismas bandas que el mapa)
  const scored = results.filter(r => typeof r.seoScore === 'number');
  const nScored = scored.length;
  const bands = [
    { key: 'debil', label: 'Débil (< 40)',      color: '#ef4444', n: scored.filter(r => r.seoScore < 40).length },
    { key: 'medio', label: 'Mejorable (40–69)', color: '#f59e0b', n: scored.filter(r => r.seoScore >= 40 && r.seoScore < 70).length },
    { key: 'bueno', label: 'Aceptable (70+)',   color: '#22c55e', n: scored.filter(r => r.seoScore >= 70).length },
  ];
  return (
    <main className="min-h-screen bg-page pt-24 pb-20 px-2 md:px-4">

      <Link href="/auditorias" className="text-xs text-fg-600 hover:text-fg-400 transition-colors mb-6 inline-block">
        ← Todas las auditorías
      </Link>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-fg-500 mb-2">{formatDate(a.publishedAt)}</p>
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-3xl md:text-4xl font-black text-fg">{a.title}</h1>
          <AuditPdfButton
            audit={{
              title: a.title,
              term: a.config?.term || '',
              categoryLabels: a.config?.tiposLabels || [],
              cities: ciudades,
              summary: a.summary || '',
              stats: a.stats || {},
              results,
              publishedAt: a.publishedAt,
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ciudades.map(c => (
            <span key={c} className="text-sm bg-fg/5 border border-fg/10 text-fg-300 px-3 py-1.5 rounded-full">📍 {c}</span>
          ))}
          {a.config?.radioKm && (
            <span className="text-sm bg-fg/5 border border-fg/10 text-fg-300 px-3 py-1.5 rounded-full">📡 Radio {a.config.radioKm} km</span>
          )}
          {(a.config?.tiposLabels || []).map(t => (
            <span key={t} className="text-sm bg-fg/5 border border-fg/10 text-fg-400 px-3 py-1.5 rounded-full">{t}</span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { value: a.stats?.total ?? '—',        label: 'Sitios analizados',  color: 'text-fg',       icon: '🌐' },
          { value: a.stats?.withEmail ?? '—',    label: 'Con email público',  color: 'text-green-600 dark:text-green-400',   icon: '✉️' },
          { value: a.stats?.lowSeoCount ?? '—',  label: 'SEO débil (< 50)',   color: 'text-red-600 dark:text-red-400',     icon: '⚠️' },
          { value: a.stats?.avgSeoScore ?? '—',  label: 'Score SEO promedio', color: 'text-indigo-600 dark:text-indigo-400',  icon: '📊' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-fg/10 rounded-xl p-5 text-center hover:border-fg/20 transition-colors">
            <div className="text-lg mb-1 opacity-70" aria-hidden>{s.icon}</div>
            <div className={`text-3xl md:text-4xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-fg-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Distribución de Score SEO */}
      {nScored > 0 && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">Distribución de Score SEO</p>
          <SeoScoreChart bands={bands} />
        </div>
      )}

      {/* Mapa — justo debajo del gráfico */}
      {results.some(r => typeof r.lat === 'number' && typeof r.lon === 'number') && (
        <div className="mb-10">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">Mapa de los negocios</p>
          <AuditMapLoader results={results} radioKm={a.config?.radioKm} ownDomains={ownDomains} />
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-fg-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#ef4444' }} /> SEO débil (&lt; 40)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#f59e0b' }} /> Mejorable (40–69)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#22c55e' }} /> Aceptable (70+)</span>
            {hasOwnSite && (
              <span className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#6366f1' }} /> ★ Hecho por mí</span>
            )}
          </div>
        </div>
      )}

      {/* Resumen Gemini */}
      {a.summary && (
        <div className="bg-card border border-fg/10 rounded-xl p-6 mb-6">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">Análisis</p>
          <p className="text-fg-300 leading-relaxed text-sm">{a.summary}</p>
        </div>
      )}

      {/* Explicación score */}
      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 mb-6 text-sm text-fg-400">
        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">¿Qué mide el Score SEO?</span>{' '}
        Evalúa sitemap (-25 si falta), robots.txt (-20), meta description (-25), Open Graph (-15) y antigüedad del sitio (-15 si más de 18 meses sin actualizar). Score 0–100: rojo = débil, amarillo = mejorable, verde = aceptable. Hacé click en los encabezados para ordenar.
      </div>

      <AuditTable results={results} ownDomains={ownDomains} />

      {/* CTA — Solicitar auditoría propia */}
      <div className="mt-16 mb-8">
        <div className="text-center mb-6">
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">¿Tu sitio está en esta lista?</p>
          <h2 className="text-2xl md:text-3xl font-black text-fg">
            Pedí tu análisis gratuito
          </h2>
          <p className="text-fg-500 text-sm mt-2 max-w-md mx-auto">
            Si tenés un negocio en Argentina, analizamos cómo aparece tu sitio en Google y te mandamos el informe sin costo.
          </p>
        </div>
        <div className="max-w-xl mx-auto">
          <AuditRequestForm defaultSearchTerm={a.config?.term || ''} />
        </div>
      </div>

      <p className="text-center text-xs text-gray-700 mt-8">
        Auditoría realizada por{' '}
        <Link href="/" className="text-fg-500 hover:text-fg-300 transition-colors">Mariano Aliandri</Link>
        {' '}· {formatDate(a.publishedAt)}
      </p>
    </main>
  );
}
