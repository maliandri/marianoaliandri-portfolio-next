import KeywordExplorer from '@/components/audit/KeywordExplorer';

export const metadata = {
  title: 'Rubros más buscados en tu zona | Explorador de Keywords locales',
  description: 'Descubrí qué servicios y rubros busca la gente en Google en cualquier localidad de Argentina. Herramienta gratuita basada en el autocompletado real de Google.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/keywords/' },
  openGraph: {
    title: 'Rubros más buscados en tu zona — Gratis | Mariano Aliandri',
    description: 'Descubrí qué servicios busca la gente en Google en tu ciudad. Ideal para validar demanda local y encontrar oportunidades de negocio.',
    url: 'https://marianoaliandri.com.ar/keywords/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Explorador de Keywords locales',
  url: 'https://marianoaliandri.com.ar/keywords/',
  description: 'Herramienta gratuita para descubrir qué rubros y servicios busca la gente en Google en cualquier localidad de Argentina, basada en el autocompletado de Google.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
  featureList: [
    'Ranking de rubros por demanda de búsqueda',
    'Cobertura de todas las provincias y localidades de Argentina',
    'Frases reales que busca la gente (long-tail)',
    'Exportación a CSV',
    'Gratuito y sin registro',
  ],
};

export default function KeywordsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <KeywordExplorer />

      {/* Preview estática de resultados — muestra lo que se obtiene antes de registrarse */}
      <section className="max-w-3xl mx-auto px-4 mb-6">
        <div className="bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-0.5">Ejemplo de resultado</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Rubros más buscados en Neuquén</p>
            </div>
            <span className="text-xs bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold px-2.5 py-1 rounded-full">Muestra</span>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Plomero', cat: 'Hogar', interes: 91, sugerencias: 14 },
              { label: 'Veterinaria', cat: 'Mascotas', interes: 87, sugerencias: 12 },
              { label: 'Contador', cat: 'Finanzas', interes: 78, sugerencias: 11 },
              { label: 'Electricista', cat: 'Hogar', interes: 73, sugerencias: 10 },
              { label: 'Psicólogo', cat: 'Salud', interes: 69, sugerencias: 9 },
              { label: 'Inmobiliaria', cat: 'Servicios', interes: 54, sugerencias: 7 },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-3">
                <div className="w-28 shrink-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{r.label}</p>
                  <p className="text-[10px] text-gray-500">{r.cat}</p>
                </div>
                <div className="flex-1 h-2 bg-gray-200 dark:bg-white/8 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.interes >= 66 ? 'bg-emerald-500' : r.interes >= 33 ? 'bg-amber-500' : 'bg-rose-400'}`}
                    style={{ width: `${r.interes}%` }}
                  />
                </div>
                <span className="text-[11px] text-gray-500 w-12 text-right shrink-0">{r.sugerencias} frases</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-600 mt-4">
            Registrate gratis para analizar cualquier localidad de Argentina →{' '}
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">1 búsqueda sin cargo, sin tarjeta</span>
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-16 text-left space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            ¿Cómo funciona?
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            La herramienta consulta el mismo motor de autocompletado que ves cuando escribís
            en Google. Por cada rubro (plomero, dentista, inmobiliaria…) mide cuántas búsquedas
            relacionadas sugiere Google para tu localidad y con qué relevancia. Cuantas más
            variantes específicas aparecen, mayor es la demanda real en esa zona.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            ¿Para qué sirve?
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            Sirve para validar la demanda de un servicio antes de invertir, detectar rubros con
            alta búsqueda y poca competencia digital, y encontrar las frases exactas que usa la
            gente para optimizar el SEO local de un negocio.
          </p>
        </div>
      </section>
    </>
  );
}
