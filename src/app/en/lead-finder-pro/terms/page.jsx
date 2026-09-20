import LeadFinderProTermsPageEn from '@/views/LeadFinderProTermsPageEn';

export const metadata = {
  title: 'Terms of Service — Lead Finder Pro',
  description: 'Terms of service for Lead Finder Pro: acceptable use, plans, credits and billing.',
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/en/lead-finder-pro/terms/',
    languages: {
      'es-AR': 'https://marianoaliandri.com.ar/lead-finder-pro/terms/',
      'en': 'https://marianoaliandri.com.ar/en/lead-finder-pro/terms/',
    },
  },
};

export default function LeadFinderProTermsEnRoute() {
  return <LeadFinderProTermsPageEn />;
}
