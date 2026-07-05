export const metadata = {
  title: 'Cotizador de Sitios Web',
  description: 'Obtené un presupuesto instantáneo para tu sitio web. Elegí las funcionalidades que necesitás y conocé el precio al instante.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/web/' },
  openGraph: {
    title: 'Cotizador de Sitios Web — Gratis | Mariano Aliandri',
    description: 'Obtené un presupuesto instantáneo para tu sitio web.',
    url: 'https://marianoaliandri.com.ar/web/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Cotizador de Sitios Web',
  url: 'https://marianoaliandri.com.ar/web/',
  description: 'Herramienta gratuita para obtener un presupuesto instantáneo de desarrollo web. Elegí las funcionalidades que necesitás (landing page, e-commerce, chatbot IA, etc.) y conocé el precio estimado al instante.',
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
          Cotizador de Sitios Web
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Obtené un presupuesto instantáneo para tu proyecto web. Seleccioná el tipo de sitio
          y las funcionalidades que necesitás — landing page, e-commerce, chatbot con IA,
          panel de administración — y conocé el precio estimado al instante.
        </p>
        <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1 mb-8">
          <li>✓ Configurador de funcionalidades paso a paso</li>
          <li>✓ Precio estimado en USD y ARS</li>
          <li>✓ Tiempo de entrega estimado</li>
          <li>✓ 100% gratuito, sin registro</li>
        </ul>
      </main>
    </>
  );
}
