import Link from 'next/link';
import PlansSection from '@/components/leadfinderpro/PlansSection';
import LanguageSwitch from '@/components/leadfinderpro/LanguageSwitch';
import AudienceHero from '@/components/leadfinderpro/AudienceHero';

export const metadata = {
  title: 'Lead Finder Pro — Find businesses with no website or weak SEO',
  description: 'Tool for devs and agencies: audit local businesses by city, state/province or whole country. Map, SEO score and contact info in one place.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/en/lead-finder-pro/',
    languages: {
      'es-AR': 'https://marianoaliandri.com.ar/lead-finder-pro/',
      'en': 'https://marianoaliandri.com.ar/en/lead-finder-pro/',
    },
  },
  openGraph: {
    title: 'Lead Finder Pro — Find businesses with no website or weak SEO',
    description: 'Audit local businesses by city, state/province or whole country: whether they have a website, SEO score, phone, hours and rating.',
    url: 'https://marianoaliandri.com.ar/en/lead-finder-pro/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Lead Finder Pro',
  url: 'https://marianoaliandri.com.ar/en/lead-finder-pro/',
  description: 'Tool for devs and agencies that audits local businesses from Google Maps by city, state/province or country: detects whether they have a website, SEO score, phone, hours and rating.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free trial with a real, already-published audit' },
  author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
  featureList: [
    'Map of local businesses by area',
    'SEO score from 0 to 100 per business',
    'Phone, hours and rating',
    'Coverage by city, state/province or country',
  ],
};

export default function LeadFinderProLandingEn() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto flex justify-end mb-4">
        <LanguageSwitch />
      </div>
      <AudienceHero lang="en" />

      <div className="max-w-4xl mx-auto bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 mb-16">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-4">How do credits work?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-white font-semibold text-sm mb-1.5">🎯 You choose how many results you want</p>
            <p className="text-gray-500 text-sm">
              Before searching, set the location, the search term, and how many businesses you want (1, 10, 50...). That&apos;s exactly what gets used from your plan — no more, no less.
            </p>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-1.5">✅ Fully audited results, no extra steps</p>
            <p className="text-gray-500 text-sm">
              No need to click &quot;audit&quot; one by one: every result comes back with website, phone, hours, rating and SEO score already included. If you&apos;d already audited a business before, it won&apos;t use another credit.
            </p>
          </div>
        </div>
        <p className="text-gray-600 text-xs mt-5">
          With the Starter plan (100/month) you can request up to 100 fully-audited businesses a month.
        </p>
      </div>

      <PlansSection lang="en" />

      <div className="max-w-4xl mx-auto text-center">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Real examples</p>
        <p className="text-gray-500 text-sm mb-6">Already-published reports, the same kind you&apos;ll see in the free trial.</p>
        <Link href="/auditorias" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
          See public audits →
        </Link>
      </div>
      </main>
    </>
  );
}
