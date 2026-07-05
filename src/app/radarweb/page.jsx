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
      </main>
    </>
  );
}
