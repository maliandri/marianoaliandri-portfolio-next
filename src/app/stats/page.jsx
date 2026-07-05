export const metadata = {
  title: 'Estadísticas del Portfolio',
  description: 'Dashboard en tiempo real con visitas, clics en Google, likes y datos de Google Search Console del portfolio de Mariano Aliandri.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/stats/' },
  openGraph: {
    title: 'Estadísticas en Tiempo Real | Mariano Aliandri',
    description: 'Dashboard con visitas, clics en Google y datos de Search Console en tiempo real.',
    url: 'https://marianoaliandri.com.ar/stats/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Dashboard de Estadísticas',
  url: 'https://marianoaliandri.com.ar/stats/',
  description: 'Dashboard en tiempo real con estadísticas del portfolio: visitas únicas, clics en Google Search, impresiones, likes y datos de Google Search Console.',
  applicationCategory: 'AnalyticsApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
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
          Estadísticas del Portfolio
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Dashboard en tiempo real con las métricas del portfolio: visitas únicas,
          clics en Google Search, impresiones totales, posición promedio en resultados
          y datos actualizados de Google Search Console.
        </p>
        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-8">
          <li>✓ Visitas en tiempo real (Firebase)</li>
          <li>✓ Clics e impresiones (Google Search Console)</li>
          <li>✓ Proyectos y estadísticas GSC por dominio</li>
          <li>✓ Likes y engagement del portfolio</li>
        </ul>

        <div className="text-left mt-12 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Qué muestra este dashboard?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Es un tablero público con las métricas reales de este portfolio: cuántas personas lo
              visitan, cuántos clics recibe desde Google, cuántas veces aparece en los resultados y en
              qué posición promedio. Los datos vienen de Google Search Console y Firebase, actualizados
              en tiempo real. La idea es predicar con el ejemplo: mostrar con números que el trabajo de
              SEO y desarrollo da resultados medibles.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿De dónde salen los datos?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Las visitas y likes se registran de forma anónima con Firebase; los clics, impresiones y
              posiciones vienen directo de la API de Google Search Console, la misma fuente oficial que
              Google usa para reportar el rendimiento de un sitio en las búsquedas.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Preguntas frecuentes</h2>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Puedo tener un dashboard así para mi negocio?</h3>
                <p className="text-gray-600 dark:text-gray-400">Sí, desarrollo dashboards de datos a medida conectados a tus fuentes reales. <a href="/presupuesto" className="text-indigo-500 hover:underline">Pedí un presupuesto</a>.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Los datos son en vivo?</h3>
                <p className="text-gray-600 dark:text-gray-400">Sí, se actualizan automáticamente con cada visita y con la información más reciente de Google Search Console.</p>
              </div>
            </div>
          </section>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Mirá también el{' '}
            <a href="/kpi" className="text-indigo-500 hover:underline">Radar de KPIs</a> o las{' '}
            <a href="/auditorias" className="text-indigo-500 hover:underline">auditorías web</a>.
          </p>
        </div>
      </main>
    </>
  );
}
