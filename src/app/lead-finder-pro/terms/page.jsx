import LeadFinderProTermsPage from '@/views/LeadFinderProTermsPage';

export const metadata = {
  title: 'Términos de Servicio — Lead Finder Pro',
  description: 'Términos de servicio de Lead Finder Pro: uso aceptable, planes, créditos y facturación.',
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/lead-finder-pro/terms/',
    languages: {
      'es-AR': 'https://marianoaliandri.com.ar/lead-finder-pro/terms/',
      'en': 'https://marianoaliandri.com.ar/en/lead-finder-pro/terms/',
    },
  },
};

export default function LeadFinderProTermsRoute() {
  return <LeadFinderProTermsPage />;
}
