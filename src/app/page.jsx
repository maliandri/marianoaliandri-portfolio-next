import HeroNew from '@/components/home/HeroNew';
import NoticiasHome from '@/components/home/NoticiasHome';
import ProyectosGrid from '@/components/home/ProyectosGrid';
import CapabilitiesCarousel from '@/components/home/CapabilitiesCarousel';
import Contact from '@/components/home/Contact';

export const metadata = {
  title: 'Mariano Aliandri | Sistemas a Medida y Desarrollo Web en Neuquén',
  description: 'Desarrollo de sistemas a medida en la nube, con base de datos y backend, y sitios web que aparecen en Google. Trabajo desde Neuquén para negocios de la ciudad, el Comahue y todo el país.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/',
  },
};

const personSchema = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: 'Mariano Aliandri',
  url: 'https://marianoaliandri.com.ar',
  image: 'https://marianoaliandri.com.ar/og-image.jpg',
  jobTitle: 'Full Stack Developer & Data Analyst',
  description: 'Desarrollador Full Stack y Analista de Datos especializado en React, Next.js, Python y Power BI. Desarrollo sistemas a medida en la nube con base de datos y backend. Basado en Neuquén, Argentina.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Neuquén',
    addressRegion: 'Neuquén',
    addressCountry: 'AR',
  },
  sameAs: [
    'https://www.linkedin.com/in/marianoaliandri',
    'https://github.com/maliandri',
  ],
  knowsAbout: [
    'React', 'Next.js', 'Python', 'Power BI', 'Firebase', 'Node.js', 'Data Analytics', 'Full Stack Development',
    'Sistemas a Medida', 'Desarrollo Backend', 'Sistemas en la Nube', 'Bases de Datos',
  ],
  offers: [
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'Sistemas a Medida en la Nube',
        description: 'Sistemas web a medida con backend y base de datos, para gestión, seguimiento y automatización de procesos de negocio.',
        url: 'https://marianoaliandri.com.ar/tienda/',
        areaServed: [
          { '@type': 'City', name: 'Neuquén' },
          { '@type': 'Country', name: 'Argentina' },
        ],
      },
    },
    {
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: 'Desarrollo Web y Análisis de Datos',
        url: 'https://marianoaliandri.com.ar/tienda/',
        areaServed: [
          { '@type': 'City', name: 'Neuquén' },
          { '@type': 'Country', name: 'Argentina' },
        ],
      },
    },
  ],
};

// Segundo schema (LocalBusiness) — el Person de arriba cubre marca personal/E-E-A-T,
// este cubre elegibilidad para búsquedas locales ("diseño web neuquén") y Google Maps.
// Coordenadas: centro de Neuquén capital.
const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: 'Mariano Aliandri — Sistemas a Medida y Desarrollo Web',
  image: 'https://marianoaliandri.com.ar/og-image.jpg',
  url: 'https://marianoaliandri.com.ar',
  telephone: '+5492995414422',
  priceRange: '$$',
  description: 'Sistemas a medida en la nube (con base de datos y backend) y sitios web para empresas, desde Neuquén para todo el país.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Neuquén',
    addressRegion: 'Neuquén',
    addressCountry: 'AR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: -38.9516,
    longitude: -68.0591,
  },
  areaServed: [
    { '@type': 'City', name: 'Neuquén' },
    { '@type': 'State', name: 'Neuquén' },
    { '@type': 'Country', name: 'Argentina' },
  ],
  sameAs: [
    'https://www.linkedin.com/in/marianoaliandri',
    'https://github.com/maliandri',
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <main className="bg-[#0a0a0a]">
        <HeroNew />
        <NoticiasHome />
        <ProyectosGrid />
        <CapabilitiesCarousel />
        <section id="contact" aria-label="Información de contacto">
          <Contact />
        </section>
      </main>
    </>
  );
}
