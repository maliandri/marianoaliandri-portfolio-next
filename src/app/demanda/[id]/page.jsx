import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';
import { fechaLarga } from '@/lib/demandaReport';
import { RankingBars, LocalidadHeatmap } from '@/components/demanda/DemandaCharts';
import DemandaShot from '@/components/demanda/DemandaShot';

// ISR on-demand: un informe no cambia; se genera en la primera visita y queda en el CDN.
export const revalidate = 86400;
export async function generateStaticParams() { return []; }

const getReporte = cache(async (id) => {
  const db = getDb();
  if (!db) return null;
  const doc = await db.collection('demanda_reportes').doc(id).get();
  if (!doc.exists) return null;
  const { createdAt: _c, postError: _e, redes: _r, ...r } = doc.data();
  return { id: doc.id, ...r };
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const r = await getReporte(id);
  if (!r) return { title: 'Informe no encontrado' };
  const url = `https://marianoaliandri.com.ar/demanda/${id}/`;
  const title = `Qué se busca en Google en ${r.zona} (${fechaLarga(r.createdAtMs)})`;
  const description = `Los ${r.top.length} rubros más buscados en ${r.localidades.join(', ')}: ${r.top.slice(0, 3).map(t => t.label).join(', ')} y más, con las frases reales que escribe la gente.`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article', url, title, description,
      ...(r.slides?.[0] ? { images: [{ url: r.slides[0], width: 1080, height: 1350, alt: title }] } : {}),
    },
  };
}

export default async function DemandaDetailPage({ params }) {
  const { id } = await params;
  const r = await getReporte(id);
  if (!r) notFound();
  const grupo = r.localidades.length > 1;
  const conCambios = r.top.some(t => t.cambio !== null || t.nuevo);

  return (
    <main className="min-h-screen bg-page pt-24 pb-20 px-4 md:px-6">
      <div className="max-w-4xl mx-auto">
        <DemandaShot />
        {/* data-sec: qué partes salen en cada captura del modo ?screenshot=1&seccion= (DemandaShot). */}
        <Link href="/demanda/" data-sec="" className="text-xs text-fg-600 hover:text-fg-400 transition-colors mb-6 inline-block">
          ← Todas las zonas
        </Link>

        <div data-sec="portada">
          <span className="block text-xs font-semibold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">
            Demanda de búsqueda · {fechaLarga(r.createdAtMs)}
          </span>
          <h1 className="text-3xl md:text-5xl font-black text-fg mt-2 mb-3">Qué se busca en Google en {r.zona}</h1>
          <p className="text-fg-400 mb-8">
            {grupo ? `${r.localidades.join(' · ')}. ` : ''}
            Los {r.top.length} rubros con más demanda{conCambios ? ' y cómo se movieron desde el informe anterior' : ''}.
          </p>
        </div>
        <p data-sec="ranking2 localidades frases cierre" className="hidden text-sm font-semibold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase mb-5">
          Qué se busca en Google en {r.zona} · {fechaLarga(r.createdAtMs)}
        </p>

        <section data-sec="portada ranking2" className="bg-card border border-fg/10 rounded-2xl p-5 md:p-6 mb-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-4">
            <h2 className="text-fg font-bold text-lg">Ranking de rubros</h2>
            <span className="text-xs text-fg-500">Índice de demanda · el primero = 100</span>
          </div>
          <RankingBars top={r.top} />
        </section>

        {grupo && (
          <section data-sec="localidades" className="bg-card border border-fg/10 rounded-2xl p-5 md:p-6 mb-8">
            <h2 className="text-fg font-bold text-lg mb-1">Qué se busca más en cada localidad</h2>
            <p className="text-sm text-fg-500 mb-4">
              Índice dentro de cada localidad: 100 es su rubro más buscado. Sirve para comparar rubros en un mismo lugar,
              no para comparar ciudades grandes con chicas.
            </p>
            <LocalidadHeatmap top={r.top} localidades={r.localidades} />
          </section>
        )}

        <section data-sec="frases" className="bg-card border border-fg/10 rounded-2xl p-5 md:p-6 mb-8">
          <h2 className="text-fg font-bold text-lg mb-4">Lo que escribe la gente</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {r.top.filter(t => t.ejemplos?.length).map(t => (
              <div key={t.id}>
                <dt className="text-sm font-semibold text-fg">{t.pos}. {t.label}</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {t.ejemplos.map(e => (
                    <span key={e} className="text-xs bg-fg/5 border border-fg/10 text-fg-400 px-2.5 py-1 rounded-full">{e}</span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <p data-sec="cierre" className="text-xs text-fg-600 mb-10 max-w-2xl">
          Cómo se calcula: para cada rubro se consulta el autocompletado de Google con el nombre de la localidad y se
          mide cuántas búsquedas sugiere y con qué relevancia. Es un índice para ordenar rubros, no la cantidad exacta de búsquedas.
        </p>

        <div data-sec="cierre" className="grid gap-4 md:grid-cols-2">
          <div className="glow-frame bg-card border border-fg/10 rounded-2xl p-6 flex flex-col">
            <p className="text-fg font-bold text-lg">¿Querés ver todos los rubros de tu ciudad?</p>
            <p className="text-fg-500 text-sm mt-1 mb-5 flex-1">Elegí cualquier localidad del país y descargá el ranking completo con todas las frases.</p>
            <Link href="/analitica/" className="self-start bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 glow-btn">
              Ver Analítica →
            </Link>
          </div>
          <div className="glow-frame bg-card border border-fg/10 rounded-2xl p-6 flex flex-col">
            <p className="text-fg font-bold text-lg">¿Tu negocio aparece cuando te buscan?</p>
            <p className="text-fg-500 text-sm mt-1 mb-5 flex-1">Hago sitios y sistemas a medida para que los clientes de tu zona te encuentren.</p>
            <Link href="/presupuesto/" className="self-start border border-fg/20 hover:border-indigo-500/60 text-fg font-semibold px-5 py-2.5 rounded-xl">
              Pedir presupuesto →
            </Link>
          </div>
        </div>
        <p data-shot-only className="hidden mt-8 text-lg font-bold text-indigo-600 dark:text-indigo-400">marianoaliandri.com.ar/demanda</p>
      </div>
    </main>
  );
}
