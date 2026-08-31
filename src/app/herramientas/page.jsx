import Link from 'next/link';
import PlansSection from '@/components/leadfinderpro/PlansSection';
import AnaliticaPlansSection from '@/components/analitica/AnaliticaPlansSection';

export const metadata = {
  title: 'Herramientas',
  description: 'Herramientas gratuitas y planes pagos: análisis de CV con IA, calculadora de ROI, cotizador web, radar KPI, Lead Finder Pro y Analítica Regional.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/herramientas' },
  openGraph: {
    type: 'website',
    url: 'https://marianoaliandri.com.ar/herramientas',
    title: 'Herramientas | Mariano Aliandri',
    description: 'Herramientas gratuitas y planes pagos: análisis de CV con IA, calculadora de ROI, cotizador web, radar KPI, Lead Finder Pro y Analítica Regional.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Herramientas — Mariano Aliandri' }],
  },
};

const FREE_TOOLS = [
  { label: 'Análisis de CV (ATS)', href: '/ats',      icon: '📄', desc: 'Analizá tu CV contra ofertas con IA' },
  { label: 'Calculadora de ROI',   href: '/roi',       icon: '📈', desc: 'Estimá el retorno de tu inversión digital' },
  { label: 'Cotizador Web',        href: '/web',       icon: '💻', desc: 'Cotizá tu sitio en segundos' },
  { label: 'Radar KPI',            href: '/kpi',       icon: '🎛️', desc: 'Indicadores clave de tu negocio' },
  { label: 'Radar Web',            href: '/radarweb',  icon: '📊', desc: 'Analizá la presencia digital de un sitio' },
  { label: 'Estadísticas',         href: '/stats',     icon: '📉', desc: 'Dashboard de stats en vivo del sitio' },
  { label: 'Labs',                 href: '/labs',      icon: '🧪', desc: 'Experimentos y herramientas en desarrollo' },
  { label: 'FAQ',                  href: '/faq',       icon: '❓', desc: '¿Cuánto cuesta? ¿Cuánto tarda? Todo acá' },
];

export default function HerramientasPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="mb-14">
          <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Todo en un lugar</span>
          <h1 className="text-4xl md:text-5xl font-black text-white mt-3 mb-4">Herramientas</h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Gratuitas para probar al toque, y dos productos con planes pagos para uso recurrente: Lead Finder Pro y Analítica Regional.
          </p>
        </div>

        {/* Gratuitas */}
        <div className="mb-20">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-4">Gratuitas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FREE_TOOLS.map(t => (
              <Link
                key={t.href}
                href={t.href}
                className="bg-[#111] border border-white/10 hover:border-indigo-500/40 rounded-2xl p-5 transition-colors group"
              >
                <span className="text-2xl">{t.icon}</span>
                <h3 className="text-white font-bold text-sm mt-3 group-hover:text-indigo-400 transition-colors">{t.label}</h3>
                <p className="text-gray-500 text-xs mt-1">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Lead Finder Pro */}
        <div className="mb-20">
          <div className="text-center mb-8">
            <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">🎯 Con plan</span>
            <h2 className="text-2xl md:text-3xl font-black text-white mt-3 mb-2">Lead Finder Pro</h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              Encontrá negocios sin sitio web o con SEO débil en cualquier zona de Argentina, con score, teléfono y horarios.
            </p>
            <Link href="/lead-finder-pro" className="inline-block mt-3 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              Ver la herramienta →
            </Link>
          </div>
          <PlansSection anchorId="planes-leadfinder" />
        </div>

        {/* Analítica Regional */}
        <div>
          <div className="text-center mb-8">
            <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">📊 Con plan</span>
            <h2 className="text-2xl md:text-3xl font-black text-white mt-3 mb-2">Analítica Regional</h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              Descubrí qué rubros y servicios tienen más demanda de búsqueda en tu zona, con las frases reales que usa la gente.
            </p>
            <Link href="/analitica" className="inline-block mt-3 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              Ver la herramienta →
            </Link>
          </div>
          <AnaliticaPlansSection anchorId="planes-analitica" />
        </div>
      </div>
    </main>
  );
}
