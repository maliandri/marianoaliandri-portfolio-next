import LeadFinderProPrivacyPageEn from '@/views/LeadFinderProPrivacyPageEn';

export const metadata = {
  title: 'Privacy Policy — Lead Finder Pro',
  description: 'Privacy policy for Lead Finder Pro: what data we collect, how business audit data is sourced, and your rights.',
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/en/lead-finder-pro/privacy/',
    languages: {
      'es-AR': 'https://marianoaliandri.com.ar/lead-finder-pro/privacy/',
      'en': 'https://marianoaliandri.com.ar/en/lead-finder-pro/privacy/',
    },
  },
};

export default function LeadFinderProPrivacyEnRoute() {
  return <LeadFinderProPrivacyPageEn />;
}
