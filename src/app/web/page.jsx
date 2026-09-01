export const metadata = {
  title: 'Cotizador de Páginas Web para Empresas | Neuquén',
  description: 'Obtené un presupuesto instantáneo para tu página web empresarial. Diseño y desarrollo web en Neuquén y todo el país — elegí las funcionalidades y conocé el precio al instante.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/web/' },
  openGraph: {
    title: 'Cotizador de Páginas Web para Empresas — Gratis | Mariano Aliandri',
    description: 'Obtené un presupuesto instantáneo para tu página web empresarial. Neuquén y todo el país.',
    url: 'https://marianoaliandri.com.ar/web/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Cotizador de Sitios Web',
  url: 'https://marianoaliandri.com.ar/web/',
  description: 'Herramienta gratuita para obtener un presupuesto instantáneo de desarrollo de páginas web para empresas en Neuquén y toda Argentina. Elegí las funcionalidades que necesitás (landing page, e-commerce, chatbot IA, etc.) y conocé el precio estimado al instante.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
  featureList: [
    'Cotización instantánea de sitios web',
    'Configurador de funcionalidades',
    'Estimación de tiempo de entrega',
    'Presupuesto en USD y ARS',
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
          Cotizador de Páginas Web para Empresas
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Obtené un presupuesto instantáneo para la página web de tu empresa o negocio. Diseño y
          desarrollo web en Neuquén y todo el país. Seleccioná el tipo de sitio y las
          funcionalidades que necesitás — landing page, e-commerce, chatbot con IA, panel de
          administración — y conocé el precio estimado al instante.
        </p>
        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-8">
          <li>✓ Configurador de funcionalidades paso a paso</li>
          <li>✓ Precio estimado en USD y ARS</li>
          <li>✓ Tiempo de entrega estimado</li>
          <li>✓ 100% gratuito, sin registro</li>
        </ul>

        <div className="text-left mt-12 space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Cuánto cuesta un sitio web?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              El precio de un sitio web depende de lo que necesite: no es lo mismo una landing page de
              una sola pantalla que una tienda online con pagos, un panel de administración o un chatbot
              con inteligencia artificial. En vez de darte un número al azar, este cotizador arma el
              presupuesto según las funcionalidades reales que elijas, para que sepas qué estás pagando
              y por qué.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">¿Cómo funciona el cotizador?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              Elegís el tipo de proyecto (landing, institucional, e-commerce, web app) y vas sumando las
              funcionalidades que te sirven: SEO, blog, reservas, integración con MercadoPago, chatbot,
              automatización de redes y más. El precio estimado se actualiza al instante en USD y ARS,
              con un tiempo de entrega aproximado. Es una guía transparente para arrancar la conversación.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Preguntas frecuentes</h2>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿El precio es definitivo?</h3>
                <p className="text-gray-600 dark:text-gray-400">Es una estimación orientativa. Para un presupuesto cerrado, revisamos juntos los detalles del proyecto.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Incluye posicionamiento en Google?</h3>
                <p className="text-gray-600 dark:text-gray-400">Sí, podés sumar SEO técnico para que el sitio aparezca en las búsquedas sin depender de publicidad paga.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200">¿Trabajás con empresas de Neuquén?</h3>
                <p className="text-gray-600 dark:text-gray-400">Sí, estoy en Neuquén capital y trabajo con negocios de la ciudad, el Comahue y también de forma remota en todo el país.</p>
              </div>
            </div>
          </section>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            ¿Listo para avanzar?{' '}
            <a href="/presupuesto" className="text-indigo-500 hover:underline">Pedí tu presupuesto</a> o calculá el{' '}
            <a href="/roi" className="text-indigo-500 hover:underline">retorno de inversión</a>.
          </p>
        </div>
      </main>
    </>
  );
}
