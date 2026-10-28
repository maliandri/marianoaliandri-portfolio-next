import TiendaServicios from '@/components/tienda/TiendaServicios';
import { SERVICES } from '@/data/serviceCatalog';

export const metadata = {
  title: 'Tienda | Armá tu web y pagá online',
  description: 'Elegí los servicios para tu sitio (landing, e-commerce, MercadoPago, dominio, Vercel, SEO), mirá el total en pesos y pagá la seña o pedí presupuesto.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/tienda/' },
  openGraph: {
    title: 'Tienda | Mariano Aliandri',
    description: 'Armá tu proyecto web servicio por servicio y pagalo con MercadoPago.',
    url: 'https://marianoaliandri.com.ar/tienda/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'OfferCatalog',
  name: 'Servicios de desarrollo web',
  url: 'https://marianoaliandri.com.ar/tienda/',
  itemListElement: SERVICES.map(cat => ({
    '@type': 'OfferCatalog',
    name: cat.category.replace(/^\S+\s/, ''),
    itemListElement: cat.items.map(s => ({
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: s.price,
      itemOffered: { '@type': 'Service', name: s.label, description: s.desc },
    })),
  })),
};

// ?servicios=landing,payments_mp preelige servicios (lo usan los links viejos de /tienda/<producto>).
export default async function TiendaPage({ searchParams }) {
  const { servicios } = await searchParams;
  const iniciales = String(servicios || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
  return (
    <main className="min-h-screen bg-page pt-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <header className="max-w-6xl mx-auto px-4 mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-primary">Tienda</p>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight text-fg [text-wrap:balance]">Armá tu web servicio por servicio</h1>
        <p className="mt-4 max-w-2xl text-lg text-fg-400">
          Marcá lo que necesitás, mirá cuánto sale en pesos y pagá la seña con MercadoPago. Si preferís hablarlo antes, pedí presupuesto sin pagar.
        </p>
      </header>
      <TiendaServicios iniciales={iniciales} />
    </main>
  );
}
