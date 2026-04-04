import HeroBuild from '@/components/HeroBuild';
import ServiciosCarousel from '@/components/ServiciosCarousel';
import TechStack from '@/components/TechStack';
import ProyectosGrid from '@/components/ProyectosGrid';
import Contact from '@/components/Contact';

export const metadata = {
  title: 'Mariano Aliandri | Dev. Full Stack, React, Python & Data',
  description: 'Desarrollador Full Stack y Analista de Datos con experiencia en React y Python. Explora mi portfolio de proyectos y habilidades en Power BI.',
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
  description: 'Desarrollador Full Stack y Analista de Datos especializado en React, Next.js, Python y Power BI. Basado en Argentina.',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'AR',
  },
  sameAs: [
    'https://www.linkedin.com/in/marianoaliandri',
    'https://github.com/maliandri',
  ],
  knowsAbout: ['React', 'Next.js', 'Python', 'Power BI', 'Firebase', 'Node.js', 'Data Analytics', 'Full Stack Development'],
  offers: {
    '@type': 'Offer',
    itemOffered: {
      '@type': 'Service',
      name: 'Desarrollo Web y Análisis de Datos',
      url: 'https://marianoaliandri.com.ar/tienda/',
    },
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
      />
      <main className="animation-section">
        <div className="animation-content-wrapper">
          <HeroBuild />
          <section id="servicios" aria-label="Servicios profesionales">
            <ServiciosCarousel />
          </section>
          <section id="skills" aria-label="Habilidades técnicas">
            <TechStack />
          </section>
          <section id="proyectos" aria-label="Proyectos realizados">
            <ProyectosGrid />
          </section>
          <section id="contact" aria-label="Información de contacto">
            <Contact />
          </section>
        </div>
      </main>
    </>
  );
}
