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
