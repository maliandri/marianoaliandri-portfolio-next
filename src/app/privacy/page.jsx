import PrivacyPage from '@/pages/PrivacyPage';

export const metadata = {
  title: 'Política de Privacidad',
  description: 'Política de privacidad y términos de uso del sitio web de Mariano Aliandri.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/privacy/',
  },
};

export default function PrivacyRoute() {
  return <PrivacyPage />;
}
