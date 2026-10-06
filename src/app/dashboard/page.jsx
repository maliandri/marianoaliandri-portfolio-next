export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Dashboard | Mariano Aliandri',
  robots: { index: false, follow: false },
};

import DashboardPage from '@/views/DashboardPage';

export default function DashboardRoute() {
  return <DashboardPage />;
}
