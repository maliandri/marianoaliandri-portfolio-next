import Link from 'next/link';
import StorePage from '@/views/StorePage';
import { products } from '@/data/products';

export const metadata = {
  title: 'Tienda | Servicios de Desarrollo Web y Data',
  description: 'Explorá nuestro catálogo de servicios: Landing Pages, Websites, E-commerce, Dashboards de Power BI, Chatbots con IA y más.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/tienda/',
  },
};

export default function TiendaPage() {
  return (
    <>
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
