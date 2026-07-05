import Link from 'next/link';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Auditorías Web',
  description: 'Reportes de auditoría SEO de sitios web de negocios locales. Analizamos presencia web, sitemap, meta tags y posicionamiento Google.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/auditorias' },
  openGraph: {
    type: 'website',
    url: 'https://marianoaliandri.com.ar/auditorias',
    title: 'Auditorías Web SEO — Negocios Locales | Mariano Aliandri',
    description: 'Reportes públicos de auditoría SEO de sitios web de negocios locales: sitemap, meta tags, Open Graph y posicionamiento en Google.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Auditorías Web SEO — Mariano Aliandri' }],
  },
};

async function getAuditorias() {
  try {
    const db = getDb();
    if (!db) return [];
    const snap = await db.collection('auditorias').orderBy('publishedAt', 'desc').limit(50).get();
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title:       data.title,
        config:      data.config,
        stats:       data.stats,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      };
    });
  } catch { return []; }
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default async function AuditoriasPage() {
  const auditorias = await getAuditorias();

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4">

        {/* Header */}
        <div className="mb-12">
          <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Informes públicos</span>
          <h1 className="text-4xl md:text-5xl font-black text-white mt-3 mb-4">
            Auditorías Web
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Análisis del estado SEO de sitios web de negocios locales. Detectamos si los sitios aparecen correctamente en Google.
          </p>
        </div>

        {/* Lista */}
        {auditorias.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-5xl mb-4">📊</p>
            <p className="text-lg">No hay auditorías publicadas todavía.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {auditorias.map(a => (
              <Link
                key={a.id}
                href={`/auditorias/${a.id}`}
                className="block bg-[#111] border border-white/10 hover:border-indigo-500/40 rounded-2xl p-6 transition-colors group"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-2">{formatDate(a.publishedAt)}</p>
                    <h2 className="text-white font-bold text-lg group-hover:text-indigo-400 transition-colors">
                      {a.title}
                    </h2>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {(a.config?.ciudades || []).map(c => (
                        <span key={c} className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
                          📍 {c}
                        </span>
                      ))}
                      {a.config?.radioKm && (
                        <span className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
                          📡 {a.config.radioKm} km
                        </span>
                      )}
                      {(a.config?.tiposLabels || []).slice(0, 4).map(t => (
                        <span key={t} className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
                          {t}
                        </span>
                      ))}
                      {(a.config?.tiposLabels || []).length > 4 && (
                        <span className="text-xs text-gray-600 px-2 py-1">
                          +{a.config.tiposLabels.length - 4} más
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-6 shrink-0">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">{a.stats?.total ?? '—'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">sitios</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-400">{a.stats?.lowSeoCount ?? '—'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">SEO débil</div>
                    </div>
                    <div className="text-center">
                      {a.stats?.avgSeoScore != null ? (
                        <>
                          <div className="text-2xl font-bold text-white">{a.stats.avgSeoScore}</div>
                          <div className="text-xs text-gray-500 mt-0.5">score prom.</div>
                        </>
                      ) : (
                        <div className="text-2xl font-bold text-gray-600">—</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors">
                  Ver reporte completo →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
