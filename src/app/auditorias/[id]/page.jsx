import Link from 'next/link';
import { notFound } from 'next/navigation';
import AuditTable from './AuditTable';

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

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function AuditoriaDetailPage({ params }) {
  const a = await getAuditoria(params.id);
  if (!a || a.error) notFound();

  const results = a.results || [];
  const ciudades = a.config?.ciudades || [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20 px-2 md:px-4">

      {/* Breadcrumb */}
      <Link href="/auditorias" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 inline-block">
        ← Todas las auditorías
      </Link>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-gray-500 mb-2">{formatDate(a.publishedAt)}</p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-4">{a.title}</h1>

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

      {/* Resumen Gemini */}
      {a.summary && (
        <div className="bg-[#111] border border-white/10 rounded-xl p-6 mb-6">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Análisis</p>
          <p className="text-gray-300 leading-relaxed text-sm">{a.summary}</p>
        </div>
      )}

      {/* Explicación score */}
      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 mb-6 text-sm text-gray-400">
        <span className="text-indigo-400 font-semibold">¿Qué mide el Score SEO?</span>{' '}
        Evalúa sitemap (-25 si falta), robots.txt (-20), meta description (-25), Open Graph (-15) y antigüedad del sitio (-15 si más de 18 meses sin actualizar). Score 0–100: rojo = débil, amarillo = mejorable, verde = aceptable. Hacé click en los encabezados para ordenar.
      </div>

      {/* Tabla sorteable — client component */}
      <AuditTable results={results} />

      {/* Footer */}
      <p className="text-center text-xs text-gray-700 mt-8">
        Auditoría realizada por{' '}
        <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">Mariano Aliandri</Link>
        {' '}· {formatDate(a.publishedAt)}
      </p>

    </main>
  );
}
