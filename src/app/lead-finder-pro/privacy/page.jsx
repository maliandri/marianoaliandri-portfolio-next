import LeadFinderProPrivacyPage from '@/views/LeadFinderProPrivacyPage';

export const metadata = {
  title: 'Política de Privacidad — Lead Finder Pro',
  description: 'Política de privacidad de Lead Finder Pro: qué datos recopilamos, cómo se obtienen los datos de auditoría de negocios y tus derechos.',
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/lead-finder-pro/privacy/',
    languages: {
      'es-AR': 'https://marianoaliandri.com.ar/lead-finder-pro/privacy/',
      'en': 'https://marianoaliandri.com.ar/en/lead-finder-pro/privacy/',
    },
  },
};

export default function LeadFinderProPrivacyRoute() {
  return <LeadFinderProPrivacyPage />;
}
