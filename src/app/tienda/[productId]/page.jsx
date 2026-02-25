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
    return {
      title: 'Producto no encontrado',
    };
  }

  return {
    title: `${product.name} | Tienda`,
    description: product.shortDescription || product.description?.substring(0, 160),
    alternates: {
      canonical: `https://marianoaliandri.com.ar/tienda/${productId}/`,
    },
  };
}

export default async function ProductPage({ params }) {
  const { productId } = await params;
  return <ProductDetailPage productId={productId} />;
}
