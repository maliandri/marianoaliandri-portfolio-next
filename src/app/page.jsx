import Hero from '@/components/Hero';
import ServiciosCarousel from '@/components/ServiciosCarousel';
import Skills from '@/components/Skills';
import Carrousel from '@/components/Carrousel';
import Contact from '@/components/Contact';

export const metadata = {
  title: 'Mariano Aliandri | Dev. Full Stack, React, Python & Data',
  description: 'Desarrollador Full Stack y Analista de Datos con experiencia en React y Python. Explora mi portfolio de proyectos y habilidades en Power BI.',
  alternates: {
    canonical: 'https://marianoaliandri.com.ar/',
  },
};

export default function HomePage() {
  return (
    <main className="animation-section">
      <div className="animation-content-wrapper">
        <Hero />
        <section id="servicios" aria-label="Servicios profesionales">
          <ServiciosCarousel />
        </section>
        <section id="skills" aria-label="Habilidades técnicas">
          <Skills />
        </section>
        <section aria-label="Carrousel de imagenes">
          <Carrousel />
        </section>
        <section id="contact" aria-label="Información de contacto">
          <Contact />
        </section>
      </div>
    </main>
  );
}
