import Link from 'next/link';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import { getDb } from '@/lib/firebase-admin';
import { isBuildPhase } from '@/lib/isr';
import PlansSection from '@/components/leadfinderpro/PlansSection';
import { scoreDistribution, shortTitle, auditCities, mapPlate } from '@/lib/auditSummary';
import ScoreDistribution from './ScoreDistribution';
import ZonePlate from './ZonePlate';
import s from './auditorias.module.css';

// ISR: se regenera como mucho una vez por hora (las auditorías salen ~4 por semana).
// /api/auditorias invalida esta página al crear, editar o borrar un informe.
export const revalidate = 3600;

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' });

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

const hostOf = url => {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
};

// Lee Firestore directo (nunca self-fetch, ver CLAUDE.md) y reduce cada informe a lo
// que la lista muestra: textos, conteos por rango y la geometría del plano. Los
// resultados por negocio (email, teléfono, nombre) no salen de esta función.
async function getAuditorias() {
  try {
    const db = getDb();
    if (!db) return { items: [], overall: null };
    const snap = await db.collection('auditorias').orderBy('publishedAt', 'desc').limit(50).get();

    const seen = new Map(); // sitio → score, para el resumen general sin contar dos veces
    const allCities = new Set();

    const items = snap.docs.map(d => {
      const data = d.data();
      const results = Array.isArray(data.results) ? data.results : [];
      const cities = auditCities(data.config, results);
      cities.forEach(c => allCities.add(c));
      for (const r of results) {
        if (typeof r?.seoScore !== 'number') continue;
        const key = hostOf(r.siteUrl) || r.id;
        if (key && !seen.has(key)) seen.set(key, r.seoScore);
      }
      const dist = scoreDistribution(results);
      return {
        id: d.id,
        title: data.title || 'Auditoría SEO',
        rubro: shortTitle(data.title, cities, results),
        cities,
        radioKm: data.config?.radioKm || null,
        avg: data.stats?.avgSeoScore ?? null,
        total: data.stats?.total ?? dist.total,
        dist,
        plate: mapPlate(results, data.config?.radioKm),
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      };
    });

    const overall = scoreDistribution([...seen.values()].map(seoScore => ({ seoScore })));
    return { items, overall: { ...overall, cities: allCities.size } };
  } catch (e) {
    if (isBuildPhase()) return { items: [], overall: null };
    throw e;
  }
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
}

export default async function AuditoriasPage() {
  const { items, overall } = await getAuditorias();
  const weak = overall?.buckets.find(b => b.key === '0');

  return (
    <main className={`${s.page} ${archivo.variable} ${plexMono.variable} min-h-screen pt-24`}>
      <div className="max-w-5xl mx-auto px-4 pb-20">

        {/* Hero: la tesis es el estado real de los sitios auditados, con la misma barra que cada informe */}
        <header className="mb-14 md:mb-16">
          <p className={`${s.eyebrow} ${s.mono}`}>Auditorías SEO · informes públicos</p>
          <h1 className={`${s.display} ${s.h1}`}>Auditorías SEO de negocios locales</h1>
          {overall?.total ? (
            <>
              <p className={s.lede}>
                Revisamos <strong>{overall.total.toLocaleString('es-AR')} sitios</strong> en{' '}
                {overall.cities} {overall.cities === 1 ? 'ciudad' : 'ciudades'}: sitemap, robots.txt, meta description,
                Open Graph y antigüedad. <strong>{weak.pct}% tiene un score por debajo de 50</strong>, lo que
                significa que Google los muestra peor de lo que podría.
              </p>
              <div className="mt-8">
                <p className={`${s.eyebrow} ${s.mono} mb-2.5`}>Score SEO de todos los sitios auditados</p>
                <ScoreDistribution buckets={overall.buckets} total={overall.total} size="lg" />
              </div>
            </>
          ) : (
            <p className={s.lede}>
              Análisis del estado SEO de sitios web de negocios locales: si aparecen bien en Google y qué les falta.
            </p>
          )}
        </header>

        {items.length === 0 ? (
          <div className="py-16 border-t" style={{ borderColor: 'var(--rule-strong)' }}>
            <p className={`${s.display} text-3xl font-bold`}>Todavía no hay informes publicados</p>
            <p className={`${s.lede} mt-2`}>
              Cuando se publique la primera auditoría va a aparecer acá, con el mapa de la zona y cómo puntúan sus sitios.
              Si querés una de tu rubro, podés generarla vos con los planes de abajo.
            </p>
          </div>
        ) : (
          <section aria-labelledby="lista-informes">
            <div className={s.listHead}>
              <h2 id="lista-informes" className={`${s.eyebrow} ${s.mono} m-0`}>
                {items.length} {items.length === 1 ? 'informe' : 'informes'}
              </h2>
              <span className={`${s.eyebrow} ${s.mono}`}>más reciente primero</span>
            </div>

            <ul className="list-none p-0 m-0 flex flex-col gap-5">
              {items.map(a => {
                const place = a.cities.length ? a.cities.join(' · ') : 'Argentina';
                return (
                  <li key={a.id}>
                    <Link href={`/auditorias/${a.id}`} className={s.card} title={a.title}>
                      <ZonePlate plate={a.plate} radioKm={a.radioKm} label={place} />
                      <div className={s.body}>
                        <p className={`${s.meta} ${s.mono} m-0`}>
                          <time dateTime={a.publishedAt || undefined}>{formatDate(a.publishedAt)}</time>
                          <span>{place}</span>
                        </p>
                        <h3 className={`${s.display} ${s.title}`}>{a.rubro}</h3>
                        <p className={`${s.sub} m-0`}>
                          <b>{a.total}</b> {a.total === 1 ? 'negocio auditado' : 'negocios auditados'}
                          {a.avg != null && <> · score promedio <b>{a.avg}</b>/100</>}
                        </p>
                        {a.dist.total > 0 && <ScoreDistribution buckets={a.dist.buckets} total={a.dist.total} />}
                        <span className={s.more}>
                          Ver informe <span className={s.arrow} aria-hidden="true">→</span>
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className={`${s.mono} mt-6 text-[11px]`} style={{ color: 'var(--ink-3)' }}>
              Mapas: ©{' '}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">
                colaboradores de OpenStreetMap
              </a>
              . Los puntos son los negocios auditados, con el color de su rango de score.
            </p>
          </section>
        )}
      </div>

      {/* Upsell: estos reportes salen de Lead Finder Pro — el mismo motor con el que
          cualquiera puede auditar sus propios negocios eligiendo un plan. Banda oscura
          fija porque PlansSection solo tiene estilos para fondo oscuro. */}
      <section className={`${s.plansBand} dark py-16`}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">¿Querés tus propias auditorías?</span>
            <p className="text-gray-400 text-sm max-w-xl mx-auto mt-2">
              Estos reportes se generan con Lead Finder Pro. Elegí un plan y auditá los negocios de tu propia zona.
            </p>
          </div>
          <PlansSection />
        </div>
      </section>
    </main>
  );
}
