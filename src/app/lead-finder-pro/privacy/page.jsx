import LeadFinderProPrivacyPage from '@/views/LeadFinderProPrivacyPage';

export const metadata = {
  title: 'Privacy Policy — Lead Finder Pro',
  description: 'Privacy policy for Lead Finder Pro: what data we collect, how business audit data is sourced, and your rights.',
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://marianoaliandri.com.ar/lead-finder-pro/privacy/' },
};

export default function LeadFinderProPrivacyRoute() {
  return <LeadFinderProPrivacyPage />;
}
