import ProfilePage from '@/views/ProfilePage';
import ClientAreaShell from '@/components/ClientAreaShell';

export const metadata = {
  title: 'Mi Perfil',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PerfilRoute() {
  return (
    <ClientAreaShell>
      <ProfilePage />
    </ClientAreaShell>
  );
}
