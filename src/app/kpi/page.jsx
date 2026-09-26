export const metadata = {
  title: 'Radar KPI — Analizá tu Negocio',
  description: 'Visualizá los KPIs clave de tu negocio en un radar interactivo. Identificá fortalezas y áreas de mejora con un vistazo.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/kpi/' },
  openGraph: {
    title: 'Radar KPI — Analizá tu Negocio | Mariano Aliandri',
    description: 'Visualizá los KPIs clave de tu negocio en un radar interactivo.',
    url: 'https://marianoaliandri.com.ar/kpi/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Radar KPI',
  url: 'https://marianoaliandri.com.ar/kpi/',
  description: 'Herramienta gratuita para visualizar los KPIs clave de tu negocio en un gráfico de radar interactivo. Identificá fortalezas y áreas de mejora de forma rápida y visual.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
  featureList: [
    'Visualización radar de KPIs',
    'Métricas de ventas, marketing, operaciones y finanzas',
    'Comparativa visual de áreas del negocio',
    'Exportable como imagen',
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
          Radar KPI
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Visualizá los indicadores clave de tu negocio en un gráfico de radar interactivo.
          Ingresá tus métricas de ventas, marketing, operaciones y finanzas para identificar
          fortalezas y áreas de mejora de un vistazo.
        </p>
        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-8">
          <li>✓ Gráfico radar interactivo</li>
          <li>✓ Múltiples dimensiones de negocio</li>
          <li>✓ Identificación visual de brechas</li>
          <li>✓ 100% gratuito, sin registro</li>
        </ul>

        <div className="text-left mt-12 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Qué es un KPI?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Un KPI (indicador clave de desempeño) es una métrica que muestra si tu negocio va bien o
              mal en un área concreta: ventas, marketing, operaciones, finanzas o atención al cliente.
              El problema no suele ser la falta de datos, sino verlos todos juntos. El radar de KPIs los
              reúne en un solo gráfico para que detectes de un vistazo dónde estás fuerte y dónde perdés
              oportunidades.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Cómo se usa?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Cargás tus valores en cada dimensión del negocio y el gráfico de radar dibuja tu perfil.
              Las áreas que se "hunden" hacia el centro son las que necesitan atención; las que se
              expanden son tus fortalezas. Es una forma rápida y visual de priorizar en qué enfocar
              tiempo y recursos.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Preguntas frecuentes</h2>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Necesito conocimientos técnicos?</h3>
                <p className="text-gray-600 dark:text-gray-400">No. Solo ingresás tus números y la herramienta arma el gráfico automáticamente.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Sirve para cualquier rubro?</h3>
                <p className="text-gray-600 dark:text-gray-400">Sí, las dimensiones son adaptables a comercios, servicios, e-commerce o profesionales independientes.</p>
              </div>
            </div>
          </section>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            ¿Querés medir tu presencia online?{' '}
            <a href="/stats" className="text-indigo-500 hover:underline">Estadísticas del portfolio</a> ·{' '}
            <a href="/radarweb" className="text-indigo-500 hover:underline">Radar Web</a>.
          </p>

          <div className="mt-8 p-5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">¿Siguiente paso?</p>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Auditá los KPIs digitales de comercios en tu zona</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Lead Finder Pro encuentra negocios locales, analiza su presencia digital y te da sus datos de contacto. Ideal para consultores y agencias.</p>
            <a href="/lead-finder-pro" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
              Ver Lead Finder Pro →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
