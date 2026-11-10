import TiendaServicios from '@/components/tienda/TiendaServicios';
import { getDb } from '@/lib/firebase-admin';
import { catalogoEfectivo, agruparCatalogo, sinPrecios } from '@/lib/tienda';
import { cargarCatalogo } from '@/lib/tiendaCheckout';

// ISR: el catálogo (sin precios) sale de Firestore y se regenera cada 5 min o cuando el admin guarda una pieza.
// Los precios NO van en el HTML: se piden con sesión de Google a /api/tienda/precios/. Por eso la preselección
// por URL (?servicios=...) se lee en el navegador y la página no depende de searchParams.
export const revalidate = 300;

export const metadata = {
  title: 'Tienda | Armá tu web y pagá online',
  description: 'Elegí las piezas de tu sitio (base, secciones, e-commerce, MercadoPago, dominio, SEO), iniciá sesión con Google para ver el total en pesos y pagá la seña o pedí presupuesto.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/tienda/' },
  openGraph: {
    title: 'Tienda | Mariano Aliandri',
    description: 'Armá tu proyecto web pieza por pieza y pagalo con MercadoPago.',
    url: 'https://marianoaliandri.com.ar/tienda/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

async function catalogoPublico() {
  const db = getDb();
  // Sin credenciales (build en CI) cae al catálogo del código; si Firestore falla, tira el error para que Next
  // conserve la última versión buena de la página.
  const items = db ? await cargarCatalogo(db) : catalogoEfectivo();
  return agruparCatalogo(sinPrecios(items));
}

export default async function TiendaPage() {
  const catalogo = await catalogoPublico();
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'OfferCatalog',
    name: 'Servicios de desarrollo web',
    url: 'https://marianoaliandri.com.ar/tienda/',
    itemListElement: catalogo.map(cat => ({
      '@type': 'OfferCatalog',
      name: cat.category.replace(/^\S+\s/, ''),
      itemListElement: cat.items.map(s => ({ '@type': 'Service', name: s.label, description: s.desc })),
    })),
  };
  return (
    <main className="min-h-screen bg-page pt-28">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <header className="max-w-6xl mx-auto px-4 mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent-primary">Tienda</p>
        <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight text-fg [text-wrap:balance]">Armá tu web pieza por pieza</h1>
        <p className="mt-4 max-w-2xl text-lg text-fg-400">
          Marcá lo que necesitás: cada pieza se suma sin repetirse con otra. Iniciá sesión con Google para ver los precios y el total en pesos, y pagá la seña con MercadoPago o pedí presupuesto.
        </p>
      </header>
      <TiendaServicios catalogo={catalogo} />
    </main>
  );
}
