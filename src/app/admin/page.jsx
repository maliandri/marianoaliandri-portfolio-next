import AdminPage from '@/pages/AdminPage';

export const metadata = {
  title: 'Panel de Administración',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminRoute() {
  return <AdminPage />;
}
