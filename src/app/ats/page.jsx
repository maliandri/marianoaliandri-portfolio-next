export const metadata = {
  title: 'Analizador de CV con IA | Mariano Aliandri',
  description: 'Subí tu CV en PDF y recibí un análisis ATS gratuito con inteligencia artificial. Sabé si tu curriculum pasa los filtros automáticos de selección.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/ats/' },
  openGraph: {
    title: 'Analizador de CV con IA — Gratis | Mariano Aliandri',
    description: 'Subí tu CV en PDF y recibí un análisis ATS gratuito con inteligencia artificial.',
    url: 'https://marianoaliandri.com.ar/ats/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Analizador de CV con IA',
  url: 'https://marianoaliandri.com.ar/ats/',
  description: 'Herramienta gratuita para analizar CVs con inteligencia artificial. Detecta si tu curriculum supera los filtros ATS usados por empresas y recruiters.',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
  featureList: [
    'Análisis ATS con IA (Google Gemini)',
    'Carga de CV en formato PDF',
    'Puntuación de compatibilidad',
    'Sugerencias de mejora personalizadas',
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
          Analizador de CV con IA
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Subí tu CV en PDF y recibí un análisis ATS instantáneo con inteligencia artificial.
          La herramienta detecta si tu curriculum supera los filtros automáticos que usan
          las empresas y recruiters, y te da sugerencias concretas para mejorarlo.
        </p>
        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-8">
          <li>✓ Análisis con Google Gemini 2.5 Flash</li>
          <li>✓ Compatibilidad con sistemas ATS</li>
          <li>✓ Sugerencias de mejora personalizadas</li>
          <li>✓ 100% gratuito, sin registro</li>
        </ul>
      </main>
    </>
  );
}
