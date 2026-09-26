export const metadata = {
  title: 'Calculadora de ROI Digital',
  description: 'Calculá el retorno de inversión de tu proyecto digital en segundos. Ingresá tus datos y obtené métricas claras de rentabilidad.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/roi/' },
  openGraph: {
    title: 'Calculadora de ROI Digital — Gratis | Mariano Aliandri',
    description: 'Calculá el retorno de inversión de tu proyecto digital en segundos.',
    url: 'https://marianoaliandri.com.ar/roi/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Calculadora de ROI Digital',
  url: 'https://marianoaliandri.com.ar/roi/',
  description: 'Herramienta gratuita para calcular el retorno de inversión (ROI) de proyectos digitales. Ingresá costos, ingresos esperados y plazo para obtener métricas claras de rentabilidad.',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
  featureList: [
    'Cálculo de ROI instantáneo',
    'Proyección de rentabilidad',
    'Visualización gráfica de resultados',
    'Análisis de punto de equilibrio',
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
          Calculadora de ROI Digital
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Calculá el retorno de inversión de tu proyecto digital en segundos.
          Ingresá tus costos, ingresos esperados y el plazo del proyecto para
          obtener métricas claras de rentabilidad y tomar mejores decisiones.
        </p>
        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-8">
          <li>✓ Cálculo de ROI y punto de equilibrio</li>
          <li>✓ Proyección mes a mes</li>
          <li>✓ Visualización gráfica interactiva</li>
          <li>✓ 100% gratuito, sin registro</li>
        </ul>

        <div className="text-left mt-12 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Qué es el ROI y por qué importa?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              El ROI (retorno de inversión) mide cuánto ganás en relación a lo que invertís. En un
              proyecto digital —una web, una campaña, una automatización— saber el ROI te permite
              decidir con números en vez de intuición: si conviene avanzar, en cuánto tiempo recuperás
              la inversión y cuál es la rentabilidad real. Esta calculadora lo estima en segundos, sin
              planillas ni fórmulas.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Cómo se calcula?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Ingresás tu inversión inicial, los costos, los ingresos esperados y el plazo del proyecto.
              La herramienta calcula el ROI porcentual, el punto de equilibrio (cuándo dejás de perder
              plata) y una proyección mes a mes, todo visualizado en un gráfico interactivo para que
              entiendas de un vistazo si el proyecto rinde.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Preguntas frecuentes</h2>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Sirve para cualquier tipo de proyecto?</h3>
                <p className="text-gray-600 dark:text-gray-400">Sí: un sitio web, una tienda online, una campaña de marketing o cualquier inversión con costos e ingresos definidos.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Qué es el punto de equilibrio?</h3>
                <p className="text-gray-600 dark:text-gray-400">Es el momento en el que los ingresos igualan a los costos: a partir de ahí, el proyecto empieza a generar ganancia.</p>
              </div>
            </div>
          </section>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            ¿Querés estimar el costo de tu proyecto?{' '}
            <a href="/web" className="text-indigo-500 hover:underline">Cotizador de sitios web</a> ·{' '}
            <a href="/kpi" className="text-indigo-500 hover:underline">Radar de KPIs</a>.
          </p>

          <div className="mt-8 p-5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">¿Siguiente paso?</p>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Encontrá negocios locales que necesiten mejorar su ROI digital</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Lead Finder Pro te da el listado de comercios en tu zona con su sitio web, email y nivel de presencia digital — para que puedas ofrecerles servicios concretos.</p>
            <a href="/lead-finder-pro" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
              Ver Lead Finder Pro →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
