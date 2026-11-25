import HeroNew from '@/components/home/HeroNew';
import NoticiasHome from '@/components/home/NoticiasHome';
import ProyectosGrid from '@/components/home/ProyectosGrid';
import CapabilitiesCarousel from '@/components/home/CapabilitiesCarousel';
import Contact from '@/components/home/Contact';
import AudienceSwitch from '@/components/home/AudienceSwitch';
import { mono, hand } from '@/components/iaPara/fonts';

// Audiencia "Sitios web": el home que tenía el sitio hasta el reposicionamiento (2026-11), tal cual.
// Spec: docs/superpowers/specs/2026-11-23-reposicionamiento-ia.md
export const metadata = {
  title: 'Diseño y Desarrollo Web en Neuquén',
  description: 'Sitios web que aparecen en Google y generan clientes: diseño, desarrollo y posicionamiento para negocios de Neuquén y todo el país. Proyectos reales con sus visitas de Search Console.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/sitios-web/' },
  openGraph: {
    type: 'website',
    url: 'https://marianoaliandri.com.ar/sitios-web/',
    title: 'Diseño y Desarrollo Web en Neuquén | Mariano Aliandri',
    description: 'Sitios web que aparecen en Google y generan clientes, para negocios de Neuquén y todo el país.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Sitios web — Mariano Aliandri' }],
  },
};

export default function SitiosWebPage() {
  return (
    <main className={`bg-page fx-grain ${mono.variable} ${hand.variable}`}>
      <div className="lg:hidden px-6 pt-20">
        <AudienceSwitch variant="inline" />
      </div>
      <HeroNew />
      <NoticiasHome />
      {/* Proyectos como polaroids (referencia unseen.co, decidido 2026-11-25) */}
      <ProyectosGrid polaroid />
      <CapabilitiesCarousel />
      <section id="contact" aria-label="Información de contacto">
        <Contact />
      </section>
    </main>
  );
}
