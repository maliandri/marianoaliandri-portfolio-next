export const metadata = {
  title: 'Estadísticas del Portfolio | Mariano Aliandri',
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
      </main>
    </>
  );
}
