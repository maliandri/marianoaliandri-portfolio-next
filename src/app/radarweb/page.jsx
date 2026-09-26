export const metadata = {
  title: 'Radar Web — Auditá tu Sitio',
  description: 'Analizá el estado de tu sitio web: velocidad, SEO, seguridad y rendimiento visualizados en un radar interactivo. Gratis y en segundos.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/radarweb/' },
  openGraph: {
    title: 'Radar Web — Auditoría de Sitio Gratis | Mariano Aliandri',
    description: 'Analizá velocidad, SEO, seguridad y rendimiento de tu sitio en un radar interactivo.',
    url: 'https://marianoaliandri.com.ar/radarweb/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Radar Web',
  url: 'https://marianoaliandri.com.ar/radarweb/',
  description: 'Herramienta gratuita para auditar tu sitio web. Analizá velocidad de carga, SEO, seguridad y rendimiento visualizados en un gráfico de radar interactivo.',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
  featureList: [
    'Análisis de velocidad de carga',
    'Auditoría SEO básica',
    'Verificación de seguridad HTTPS',
    'Visualización radar del estado general',
    'Gratuito y sin registro',
  ],
};

// El modal se renderiza en providers.jsx según el pathname.
export default function ToolPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Radar Web
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Auditá tu sitio web en segundos. Ingresá tu URL y analizá velocidad de carga,
          SEO, seguridad y rendimiento general visualizados en un gráfico de radar interactivo.
          Identificá rápidamente qué áreas necesitan atención.
        </p>
        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-8">
          <li>✓ Análisis de velocidad y rendimiento</li>
          <li>✓ Auditoría SEO y seguridad</li>
          <li>✓ Visualización radar interactiva</li>
          <li>✓ 100% gratuito, sin registro</li>
        </ul>

        <div className="text-left mt-12 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Por qué auditar tu sitio web?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Un sitio puede verse lindo y aun así estar perdiendo clientes: si carga lento, no está
              optimizado para Google o tiene problemas de seguridad, la gente se va y las búsquedas no
              lo muestran. Radar Web analiza esos puntos críticos y te los presenta en un gráfico claro,
              para que sepas qué mejorar antes de que te cueste ventas.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Qué analiza?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Con solo tu URL, la herramienta evalúa velocidad de carga, buenas prácticas de SEO,
              seguridad (HTTPS, cabeceras) y rendimiento general. Cada dimensión se dibuja en el radar:
              cuanto más se acerca al borde, mejor está esa área. Es un diagnóstico rápido para saber
              por dónde empezar.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Preguntas frecuentes</h2>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Funciona con cualquier sitio?</h3>
                <p className="text-gray-600 dark:text-gray-400">Sí, con cualquier URL pública: tu web, la de tu negocio o la de un competidor.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿En qué se diferencia de las auditorías?</h3>
                <p className="text-gray-600 dark:text-gray-400">Radar Web es un chequeo instantáneo y visual; las <a href="/auditorias" className="text-indigo-500 hover:underline">auditorías SEO</a> son informes más completos de negocios locales.</p>
              </div>
            </div>
          </section>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            ¿Necesitás un sitio nuevo?{' '}
            <a href="/web" className="text-indigo-500 hover:underline">Cotizá tu sitio web</a> o revisá las{' '}
            <a href="/auditorias" className="text-indigo-500 hover:underline">auditorías publicadas</a>.
          </p>

          <div className="mt-8 p-5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">¿Usás esto para prospectar?</p>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Encontrá negocios con sitios que necesitan mejoras</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Lead Finder Pro analiza la presencia digital de comercios locales y te da sus datos de contacto. Ideal para agencias y freelancers que ofrecen servicios web.</p>
            <a href="/lead-finder-pro" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
              Ver Lead Finder Pro →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
