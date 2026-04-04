import ProductDetailPage from '@/views/ProductDetailPage';
import { products } from '@/data/products';

export async function generateStaticParams() {
  return products.map((product) => ({
    productId: product.id,
  }));
}

export async function generateMetadata({ params }) {
  const { productId } = await params;
  const product = products.find((p) => p.id === productId);

  if (!product) {
    return { title: 'Producto no encontrado' };
  }

  const description = product.shortDescription
    ? `${product.shortDescription}. ${product.description}`.substring(0, 160)
    : product.description?.substring(0, 160);

  return {
    title: `${product.name} | Mariano Aliandri`,
    description,
    alternates: {
      canonical: `https://marianoaliandri.com.ar/tienda/${productId}/`,
    },
    openGraph: {
      title: `${product.name} | Mariano Aliandri`,
      description,
      url: `https://marianoaliandri.com.ar/tienda/${productId}/`,
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
  };
}

function buildSchemas(product, productId) {
  const url = `https://marianoaliandri.com.ar/tienda/${productId}/`;

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://marianoaliandri.com.ar/' },
      { '@type': 'ListItem', position: 2, name: 'Tienda', item: 'https://marianoaliandri.com.ar/tienda/' },
      { '@type': 'ListItem', position: 3, name: product.name, item: url },
    ],
  };

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    url,
    image: 'https://marianoaliandri.com.ar/og-image.jpg',
    brand: {
      '@type': 'Person',
      name: 'Mariano Aliandri',
      url: 'https://marianoaliandri.com.ar',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      ...(product.priceUSD
        ? { price: product.priceUSD, priceValidUntil: '2027-12-31' }
        : { price: '0', priceSpecification: { '@type': 'PriceSpecification', description: 'Cotización personalizada' } }),
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Person',
        name: 'Mariano Aliandri',
        url: 'https://marianoaliandri.com.ar',
      },
      url,
    },
    ...(product.features?.length > 0 && {
      additionalProperty: product.features.map((f) => ({
        '@type': 'PropertyValue',
        name: 'Característica',
        value: f,
      })),
    }),
  };

  return [breadcrumb, productSchema];
}

export default async function ProductPage({ params }) {
  const { productId } = await params;
  const product = products.find((p) => p.id === productId);
  const schemas = product ? buildSchemas(product, productId) : [];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <ProductDetailPage productId={productId} />
    </>
  );
}
