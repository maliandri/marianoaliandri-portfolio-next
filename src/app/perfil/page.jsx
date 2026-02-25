import ProfilePage from '@/views/ProfilePage';

export const metadata = {
  title: 'Mi Perfil',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PerfilRoute() {
  return <ProfilePage />;
}
