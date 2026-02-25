import StorePage from '@/pages/StorePage';

export const metadata = {
  title: 'Tienda | Servicios de Desarrollo Web y Data',
  description: 'Explorá nuestro catálogo de servicios: Landing Pages, Websites, E-commerce, Dashboards de Power BI, Chatbots con IA y más.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/tienda/',
  },
};

export default function TiendaPage() {
  return <StorePage />;
}
