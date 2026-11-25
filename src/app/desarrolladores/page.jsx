import Link from 'next/link';
import AudienceSwitch from '@/components/home/AudienceSwitch';

// Audiencia "Desarrolladores": solo los dos productos pensados para devs y freelancers que le venden a
// negocios (decisión 2026-11-25: sin stack ni bloque de GitHub/LinkedIn).
// Spec: docs/superpowers/specs/2026-11-23-reposicionamiento-ia.md
export const metadata = {
  title: 'Para Desarrolladores',
  description: 'Lead Finder Pro y Analítica Regional: encontrá negocios sin web o con SEO débil y los rubros más buscados en cada zona de Argentina.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/desarrolladores/' },
  openGraph: {
    type: 'website',
    url: 'https://marianoaliandri.com.ar/desarrolladores/',
    title: 'Para Desarrolladores | Mariano Aliandri',
    description: 'Herramientas para devs y freelancers que le venden a negocios: Lead Finder Pro y Analítica Regional.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Para desarrolladores — Mariano Aliandri' }],
  },
};

const PRODUCTOS = [
  {
    href: '/lead-finder-pro',
    icon: '🎯',
    titulo: 'Lead Finder Pro',
    texto: 'Buscá negocios por rubro y localidad en cualquier zona de Argentina. Te dice cuáles no tienen web o la tienen floja (con puntaje SEO), con teléfono, WhatsApp e Instagram. Pagás solo por lead útil.',
    cta: 'Ver Lead Finder Pro',
  },
  {
    href: '/analitica',
    icon: '📊',
    titulo: 'Analítica Regional',
    texto: 'Qué rubros y servicios busca la gente en Google en cada localidad, con las frases reales. Sirve para elegir a qué rubro venderle antes de salir a buscar clientes.',
    cta: 'Ver Analítica Regional',
  },
];

export default function DesarrolladoresPage() {
  return (
    <main className="bg-page min-h-screen pt-24 pb-20 px-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-20">
        <div className="hero-glow flex flex-col gap-5 max-w-3xl">
          <AudienceSwitch variant="inline" />
          <span className="text-xs font-semibold tracking-widest uppercase text-indigo-600 dark:text-indigo-400">Para desarrolladores</span>
          <h1 className="text-4xl md:text-6xl font-black text-fg leading-[1.05] tracking-tight">
            Encontrá a quién <span className="text-gradient">venderle</span>
          </h1>
          <p className="text-lg text-fg-400 leading-relaxed">
            Si sos dev o freelancer y le vendés a negocios, estas son las herramientas que armé para conseguir mis propios clientes.
            Las mismas, con planes para que las uses vos.
          </p>
        </div>

        <section aria-label="Productos" className="grid md:grid-cols-2 gap-5">
          {PRODUCTOS.map(p => (
            <Link key={p.href} href={p.href} className="glow-frame bg-card rounded-2xl p-7 flex flex-col gap-3 group">
              <span className="text-3xl" aria-hidden>{p.icon}</span>
              <h2 className="text-2xl font-bold text-fg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.titulo}</h2>
              <p className="text-fg-400 leading-relaxed">{p.texto}</p>
              <span className="mt-auto pt-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{p.cta} →</span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
