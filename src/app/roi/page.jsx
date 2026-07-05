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
      </main>
    </>
  );
}
