import Link from 'next/link';
import StorePage from '@/views/StorePage';
import { products } from '@/data/products';

export const metadata = {
  title: 'Tienda | Servicios de Desarrollo Web y Data',
  description: 'Explorá nuestro catálogo de servicios: Landing Pages, Websites, E-commerce, Dashboards de Power BI, Chatbots con IA y más.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/tienda/',
  },
  openGraph: {
    title: 'Tienda de Servicios | Mariano Aliandri',
    description: 'Landing Pages, Websites, E-commerce, Dashboards de Power BI, Chatbots con IA y más.',
    url: 'https://marianoaliandri.com.ar/tienda/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const itemListSchema = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Servicios de Desarrollo Web y Data Analytics',
  description: 'Catálogo de servicios profesionales de Mariano Aliandri: desarrollo web, e-commerce, dashboards de Power BI y chatbots con IA.',
  url: 'https://marianoaliandri.com.ar/tienda/',
  numberOfItems: products.length,
  itemListElement: products.map((product, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: product.name,
    description: product.shortDescription,
    url: `https://marianoaliandri.com.ar/tienda/${product.id}/`,
    item: {
      '@type': 'Product',
      name: product.name,
      description: product.shortDescription,
      url: `https://marianoaliandri.com.ar/tienda/${product.id}/`,
      ...(product.priceUSD && {
        offers: {
          '@type': 'Offer',
          price: product.priceUSD,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
      }),
    },
  })),
};

export default function TiendaPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      {/* Links estáticos para crawlers — invisibles para usuarios */}
      <nav aria-label="Productos" className="sr-only">
        {products.map((product) => (
          <Link key={product.id} href={`/tienda/${product.id}`}>
            {product.name}
          </Link>
        ))}
      </nav>
      <StorePage />
    </>
  );
}
