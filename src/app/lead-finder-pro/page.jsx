import Link from 'next/link';
import PlansSection from '@/components/leadfinderpro/PlansSection';
import LanguageSwitch from '@/components/leadfinderpro/LanguageSwitch';
import AudienceHero from '@/components/leadfinderpro/AudienceHero';

export const metadata = {
  title: 'Lead Finder Pro — Negocios sin sitio o con SEO débil',
  description: 'Herramienta para devs y agencias: auditá negocios locales por localidad, provincia o todo el país. Mapa, score SEO y datos de contacto en un solo lugar.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/lead-finder-pro/',
    languages: {
      'es-AR': 'https://marianoaliandri.com.ar/lead-finder-pro/',
      'en': 'https://marianoaliandri.com.ar/en/lead-finder-pro/',
    },
  },
  openGraph: {
    title: 'Lead Finder Pro — Encontrá negocios sin sitio o con SEO débil',
    description: 'Auditá negocios locales por localidad, provincia o todo el país: si tienen sitio, score SEO, teléfono, horarios y rating.',
    url: 'https://marianoaliandri.com.ar/lead-finder-pro/',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Lead Finder Pro',
  url: 'https://marianoaliandri.com.ar/lead-finder-pro/',
  description: 'Herramienta para devs y agencias que audita negocios locales de Google Maps por localidad, provincia o país: detecta si tienen sitio web, score SEO, teléfono, horarios y rating.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'ARS', description: 'Prueba gratuita con una auditoría real ya publicada' },
  author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
  featureList: [
    'Mapa de negocios locales por zona',
    'Score SEO de 0 a 100 por negocio',
    'Teléfono, horarios y rating',
    'Alcance por localidad, provincia o país',
  ],
};

export default function LeadFinderProLanding() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto flex justify-end mb-4">
        <LanguageSwitch />
      </div>
      <AudienceHero />

      <div className="max-w-4xl mx-auto bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 mb-16">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-4">¿Cómo funcionan los créditos?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-white font-semibold text-sm mb-1.5">🎯 Vos elegís cuántos resultados querés</p>
            <p className="text-gray-500 text-sm">
              Antes de buscar, poné la localidad, el término y cuántos negocios querés (1, 10, 50...). Eso es exactamente lo que se gasta de tu plan — ni más, ni menos.
            </p>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-1.5">✅ Resultados ya auditados, sin pasos extra</p>
            <p className="text-gray-500 text-sm">
              No hay que tildar "auditar" uno por uno: cada resultado llega directo con website, teléfono, horarios, rating y score SEO. Si un negocio ya lo habías auditado antes, no te vuelve a cobrar el crédito.
            </p>
          </div>
        </div>
        <p className="text-gray-600 text-xs mt-5">
          Con el plan Starter (100/mes) podés pedir hasta 100 negocios completamente auditados por mes.
        </p>
      </div>

      <PlansSection />

      <div className="max-w-4xl mx-auto text-center">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Ejemplos reales</p>
        <p className="text-gray-500 text-sm mb-6">Reportes ya publicados, del mismo tipo que vas a ver en la prueba gratuita.</p>
        <Link href="/auditorias" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
          Ver auditorías públicas →
        </Link>
      </div>
      </main>
    </>
  );
}
