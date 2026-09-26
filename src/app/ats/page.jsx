export const metadata = {
  title: 'Analizador de CV — Test ATS Gratis',
  description: 'Subí tu CV en PDF y descubrí si pasa los filtros ATS que usan las empresas. Score de compatibilidad por profesión, palabras clave que faltan y sugerencias concretas. Gratis, sin registro.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/ats/' },
  openGraph: {
    title: 'Analizador de CV — Test ATS Gratis | Mariano Aliandri',
    description: 'Subí tu CV en PDF y descubrí si pasa los filtros ATS que usan las empresas para preseleccionar candidatos.',
    url: 'https://marianoaliandri.com.ar/ats/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Analizador de CV — Test ATS',
  url: 'https://marianoaliandri.com.ar/ats/',
  description: 'Herramienta gratuita que simula los filtros ATS de las empresas: detecta si tu CV tiene las palabras clave y la estructura que buscan para cada profesión.',
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
          Analizador de CV — Test ATS Gratis
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Subí tu CV en PDF y descubrí si pasa los filtros automáticos que usan las empresas
          y consultoras para preseleccionar candidatos. Te mostramos tu compatibilidad contra
          20 perfiles profesionales, qué palabras clave tenés y cuáles te faltan.
        </p>
        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-8">
          <li>✓ Compara tu CV contra 20 perfiles profesionales</li>
          <li>✓ Simula los filtros de los sistemas ATS reales</li>
          <li>✓ Palabras clave presentes y faltantes por profesión</li>
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
              Subís tu CV en PDF y lo comparamos en segundos contra las palabras clave y la
              estructura (experiencia, educación, contacto, habilidades) que buscan los sistemas
              ATS reales para cada profesión. Recibís un score de compatibilidad, qué palabras
              clave tenés y cuáles te faltan, para aumentar tus chances de llegar a la entrevista.
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

          <div className="mt-8 p-5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">¿Sos recruiter o consultora?</p>
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">Automatizá la búsqueda de candidatos o clientes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Si necesitás un sistema a medida para gestión de postulaciones, base de candidatos o automatización de procesos, podemos construirlo juntos.</p>
            <a href="/presupuesto" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
              Solicitar presupuesto →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
