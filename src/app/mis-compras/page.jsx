import OrdersPage from '@/pages/OrdersPage';

export const metadata = {
  title: 'Mis Compras',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MisComprasRoute() {
  return <OrdersPage />;
}
