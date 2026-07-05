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
      </main>
    </>
  );
}
