import OrdersPage from '@/views/OrdersPage';
import ClientAreaShell from '@/components/ClientAreaShell';

export const metadata = {
  title: 'Mis Compras',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MisComprasRoute() {
  return (
    <ClientAreaShell>
      <OrdersPage />
    </ClientAreaShell>
  );
}
