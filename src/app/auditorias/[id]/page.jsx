import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';
import AuditTable from './AuditTable';
import AuditMapLoader from './AuditMapLoader';

export const dynamic = 'force-dynamic';

async function getAuditoria(id) {
  try {
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
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const a = await getAuditoria(id);
  if (!a) return { title: 'Auditoría no encontrada' };
  return {
    title: `${a.title} | Auditorías Web`,
    description: `Reporte SEO de ${a.stats?.total} sitios web en ${(a.config?.ciudades || []).join(', ')}.`,
    alternates: { canonical: `https://marianoaliandri.com.ar/auditorias/${id}` },
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

  const results  = a.results || [];
  const ciudades = a.config?.ciudades || [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20 px-2 md:px-4">

      <Link href="/auditorias" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 inline-block">
        ← Todas las auditorías
      </Link>

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs text-gray-500 mb-2">{formatDate(a.publishedAt)}</p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-4">{a.title}</h1>
        <div className="flex flex-wrap gap-2">
          {ciudades.map(c => (
            <span key={c} className="text-sm bg-white/5 border border-white/10 text-gray-300 px-3 py-1.5 rounded-full">📍 {c}</span>
          ))}
          {a.config?.radioKm && (
            <span className="text-sm bg-white/5 border border-white/10 text-gray-300 px-3 py-1.5 rounded-full">📡 Radio {a.config.radioKm} km</span>
          )}
          {(a.config?.tiposLabels || []).map(t => (
            <span key={t} className="text-sm bg-white/5 border border-white/10 text-gray-400 px-3 py-1.5 rounded-full">{t}</span>
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

      {results.some(r => typeof r.lat === 'number' && typeof r.lon === 'number') && (
        <div className="mb-8">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Mapa de los negocios</p>
          <AuditMapLoader results={results} />
          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#ef4444' }} /> SEO débil (&lt; 40)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#f59e0b' }} /> Mejorable (40–69)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: '#22c55e' }} /> Aceptable (70+)</span>
          </div>
        </div>
      )}

      <AuditTable results={results} />

      <p className="text-center text-xs text-gray-700 mt-8">
        Auditoría realizada por{' '}
        <Link href="/" className="text-gray-500 hover:text-gray-300 transition-colors">Mariano Aliandri</Link>
        {' '}· {formatDate(a.publishedAt)}
      </p>
    </main>
  );
}
