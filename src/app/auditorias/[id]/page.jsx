import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function getAuditoria(id) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://marianoaliandri.com.ar'}/api/auditorias?id=${id}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const a = await getAuditoria(params.id);
  if (!a) return { title: 'Auditoría no encontrada' };
  return {
    title: `${a.title} | Auditorías Web`,
    description: `Reporte SEO de ${a.stats?.total} sitios web en ${(a.config?.ciudades || []).join(', ')}.`,
  };
}

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-gray-600 text-xs">—</span>;
  const cls = score >= 70 ? 'bg-green-500/15 text-green-400 border-green-500/30'
            : score >= 40 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {score}
    </span>
  );
}

function Check({ val }) {
  if (val === null || val === undefined) return <span className="text-gray-700 text-xs">—</span>;
  return val
    ? <span className="text-green-500 text-sm">✓</span>
    : <span className="text-red-500 text-sm">✗</span>;
}

function shortUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 40);
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function AuditoriaDetailPage({ params }) {
  const a = await getAuditoria(params.id);
  if (!a || a.error) notFound();

  const results = (a.results || []).sort((x, y) => (x.seoScore ?? 999) - (y.seoScore ?? 999));
  const ciudades = a.config?.ciudades || [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4">

        {/* Breadcrumb */}
        <Link href="/auditorias" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 inline-block">
          ← Todas las auditorías
        </Link>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-gray-500 mb-2">{formatDate(a.publishedAt)}</p>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-4">{a.title}</h1>

          {/* Config badges */}
          <div className="flex flex-wrap gap-2">
            {ciudades.map(c => (
              <span key={c} className="text-sm bg-white/5 border border-white/10 text-gray-300 px-3 py-1.5 rounded-full">
                📍 {c}
              </span>
            ))}
            {a.config?.radioKm && (
              <span className="text-sm bg-white/5 border border-white/10 text-gray-300 px-3 py-1.5 rounded-full">
                📡 Radio {a.config.radioKm} km
              </span>
            )}
            {(a.config?.tiposLabels || []).map(t => (
              <span key={t} className="text-sm bg-white/5 border border-white/10 text-gray-400 px-3 py-1.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { value: a.stats?.total ?? '—',        label: 'Sitios analizados',  color: 'text-white' },
            { value: a.stats?.withEmail ?? '—',    label: 'Con email público',  color: 'text-green-400' },
            { value: a.stats?.lowSeoCount ?? '—',  label: 'SEO débil (< 50)',   color: 'text-red-400' },
            { value: a.stats?.avgSeoScore ?? '—',  label: 'Score SEO promedio', color: 'text-indigo-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#111] border border-white/10 rounded-xl p-5 text-center">
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Explicación de columnas */}
        <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 mb-6 text-sm text-gray-400">
          <span className="text-indigo-400 font-semibold">¿Qué mide el Score SEO?</span>{' '}
          Evalúa sitemap (-25 si falta), robots.txt (-20), meta description (-25), Open Graph (-15) y antigüedad del sitio (-15 si tiene más de 18 meses sin actualizar). Score 0–100: rojo = SEO débil, amarillo = mejorable, verde = aceptable.
        </div>

        {/* Tabla */}
        <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['#', 'Negocio', 'Ciudad', 'Sitio web', 'Score', 'Sitemap', 'Robots', 'Meta', 'OG', 'Actualizado', '★'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map((neg, i) => (
                  <tr key={neg.id || i} className="hover:bg-white/3 transition-colors">
                    <td className="px-4 py-3 text-gray-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <div className="font-medium text-white truncate" title={neg.nombre}>{neg.nombre}</div>
                      <div className="text-xs text-gray-600 truncate mt-0.5" title={neg.direccion}>{neg.direccion}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">{neg.ciudad || '—'}</td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <a href={neg.siteUrl} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 text-xs truncate block transition-colors"
                        title={neg.siteUrl}>
                        {shortUrl(neg.siteUrl)}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <ScoreBadge score={neg.seoScore} />
                    </td>
                    <td className="px-4 py-3 text-center"><Check val={neg.hasSitemap} /></td>
                    <td className="px-4 py-3 text-center"><Check val={neg.hasRobots} /></td>
                    <td className="px-4 py-3 text-center"><Check val={neg.metaDesc != null ? !!neg.metaDesc : null} /></td>
                    <td className="px-4 py-3 text-center"><Check val={neg.hasOG} /></td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {neg.lastModified
                        ? new Date(neg.lastModified).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-yellow-500 whitespace-nowrap">
                      {neg.rating ? `★ ${neg.rating}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-700 mt-8">
          Auditoría realizada por{' '}
          <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">Mariano Aliandri</Link>
          {' '}· {formatDate(a.publishedAt)}
        </p>

      </div>
    </main>
  );
}
