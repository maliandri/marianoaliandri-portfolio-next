import TiendaServicios from '@/components/tienda/TiendaServicios';
import { display, mono } from '@/components/iaPara/fonts';
import { getDb } from '@/lib/firebase-admin';
import { catalogoEfectivo, agruparCatalogo, sinPrecios } from '@/lib/tienda';
import { cargarCatalogo } from '@/lib/tiendaCheckout';

// ISR: el catálogo (sin precios) sale de Firestore y se regenera cada 5 min o cuando el admin guarda una pieza.
// Los precios NO van en el HTML: se piden con sesión de Google a /api/tienda/precios/. Por eso la preselección
// por URL (?servicios=...) se lee en el navegador y la página no depende de searchParams.
export const revalidate = 300;

export const metadata = {
  title: 'Tienda | Elegí lo que necesita tu negocio y pedí presupuesto',
  description: 'Marcá lo que necesita tu negocio (web, tienda online, cobros, turnos, IA), un asistente te explica cada cosa y pedís tu presupuesto con una charla por Meet o WhatsApp.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/tienda/' },
  openGraph: {
    title: 'Tienda | Mariano Aliandri',
    description: 'Marcá lo que necesita tu negocio y pedí tu presupuesto a medida.',
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
    <main className={`min-h-screen bg-page pt-28 ${display.variable} ${mono.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <header className="max-w-7xl mx-auto px-4 mb-8">
        <p className="font-[family-name:var(--font-ia-mono)] text-xs uppercase tracking-[0.2em] text-accent-primary">Tienda</p>
        <h1 className="mt-3 font-[family-name:var(--font-ia-display)] text-4xl md:text-5xl font-extrabold tracking-tight text-fg [text-wrap:balance]">¿Qué necesita tu negocio?</h1>
        <p className="mt-4 max-w-2xl text-lg text-fg-400">
          Marcá lo que te interese y te explico cada cosa. Después lo charlamos (por Meet o WhatsApp) y te paso el presupuesto cerrado.
        </p>
      </header>
      <TiendaServicios catalogo={catalogo} />
    </main>
  );
}
