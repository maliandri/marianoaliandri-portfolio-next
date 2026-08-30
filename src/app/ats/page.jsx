export const metadata = {
  title: 'Analizador de CV con IA',
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
    'Análisis ATS por coincidencia de palabras clave',
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
          <li>✓ Análisis instantáneo por coincidencia de palabras clave</li>
          <li>✓ Compatibilidad con sistemas ATS</li>
          <li>✓ Sugerencias de mejora personalizadas</li>
          <li>✓ 100% gratuito, sin registro</li>
        </ul>

        <div className="text-left mt-12 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Qué es un sistema ATS?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Un ATS (Applicant Tracking System) es el software que usan la mayoría de las empresas y
              consultoras para filtrar CVs antes de que los vea una persona. Si tu curriculum no está
              bien estructurado —con las palabras clave del puesto, un formato legible y las secciones
              correctas— el sistema puede descartarlo automáticamente, aunque tu perfil sea ideal para
              el trabajo. Este analizador simula ese filtro y te muestra exactamente qué está fallando.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Cómo funciona?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Subís tu CV en PDF y lo analizamos en segundos:
              revisa la estructura, la presencia de palabras clave, la claridad de la experiencia y la
              compatibilidad general con los filtros automáticos. Recibís una puntuación y una lista de
              mejoras concretas para aumentar tus chances de llegar a la entrevista.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Preguntas frecuentes</h2>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Es realmente gratis?</h3>
                <p className="text-gray-600 dark:text-gray-400">Sí, el análisis es 100% gratuito y no necesitás registrarte ni dejar tu email.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Guardan mi CV?</h3>
                <p className="text-gray-600 dark:text-gray-400">No. El archivo se procesa solo para el análisis y no se almacena.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿En qué formato tiene que estar?</h3>
                <p className="text-gray-600 dark:text-gray-400">En PDF, que es el formato que mejor leen los sistemas ATS.</p>
              </div>
            </div>
          </section>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            ¿Buscás mejorar la presencia digital de tu negocio?{' '}
            <a href="/web" className="text-indigo-500 hover:underline">Cotizá tu sitio web</a> o mirá las{' '}
            <a href="/auditorias" className="text-indigo-500 hover:underline">auditorías SEO</a>.
          </p>
        </div>
      </main>
    </>
  );
}
