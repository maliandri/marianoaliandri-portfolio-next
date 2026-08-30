import Link from 'next/link';

export const metadata = {
  title: 'Lead Finder Pro — Encontrá negocios sin sitio o con SEO débil',
  description: 'Herramienta para devs y agencias: auditá negocios locales por localidad, provincia o todo el país. Mapa, score SEO y datos de contacto en un solo lugar.',
};

const FEATURES = [
  { icon: '🗺️', title: 'Mapa en vivo', desc: 'Ubicación, distancia y estado de cada negocio de la zona que elijas.' },
  { icon: '📊', title: 'Score SEO por negocio', desc: 'Sitemap, robots.txt, meta description, Open Graph y antigüedad del sitio.' },
  { icon: '☎️', title: 'Teléfono, horarios y rating', desc: 'Datos de contacto listos para armar tu lista de prospección.' },
  { icon: '📍', title: 'Por localidad, provincia o país', desc: 'Elegí el alcance según lo que necesites auditar.' },
];

export default function LeadFinderProLanding() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto text-center mb-14">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Para devs y agencias</p>
        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-5">
          Encontrá negocios sin sitio<br className="hidden sm:block" /> o con SEO débil
        </h1>
        <p className="text-gray-400 text-base max-w-xl mx-auto mb-8">
          En vez de salir a golpear puertas a ciegas, elegís una zona — localidad, provincia o todo
          el país — y un rubro, y te devolvemos la lista completa de negocios reales de Google Maps:
          si tienen sitio web o no (los que no tienen son el lead más caliente), score SEO de 0 a 100,
          teléfono, horarios y rating listos para armar tu lista de contacto, con mapa y tabla ordenable
          para priorizar por zona o por qué tan débil está su presencia digital. Es la misma herramienta
          que uso yo para conseguir mis propios clientes — ahora la podés usar vos para conseguir los tuyos.
        </p>
        <Link
          href="/lead-finder-pro/demo"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors"
        >
          Probar gratis <span aria-hidden>→</span>
        </Link>
        <p className="text-xs text-gray-600 mt-3">Sin tarjeta. Ves una auditoría real completa.</p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
        {FEATURES.map(f => (
          <div key={f.title} className="bg-[#111] border border-white/10 rounded-2xl p-6">
            <div className="text-2xl mb-3" aria-hidden>{f.icon}</div>
            <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
            <p className="text-gray-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto bg-[#111] border border-white/10 rounded-2xl p-6 md:p-8 mb-16">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-4">¿Qué significa "100 negocios por mes"?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-white font-semibold text-sm mb-1.5">🔍 Buscar y explorar — sin límite</p>
            <p className="text-gray-500 text-sm">
              Recorré el mapa, cambiá de rubro o de zona las veces que quieras. Ver los negocios de tu búsqueda no gasta nada de tu plan.
            </p>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-1.5">✅ Auditar a fondo — 1 crédito por negocio</p>
            <p className="text-gray-500 text-sm">
              Cuando pedís el detalle completo de un negocio (website, teléfono, horarios, rating, score SEO), ahí sí consume 1 de tus créditos del mes. Vos elegís cuáles priorizar.
            </p>
          </div>
        </div>
        <p className="text-gray-600 text-xs mt-5">
          Con el plan Starter (100/mes) podés explorar toda tu zona sin límite, y quedarte con el detalle completo de los 100 negocios que más te sirvan.
        </p>
      </div>

      <div className="max-w-4xl mx-auto text-center">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Ejemplos reales</p>
        <p className="text-gray-500 text-sm mb-6">Reportes ya publicados, del mismo tipo que vas a ver en la prueba gratuita.</p>
        <Link href="/auditorias" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
          Ver auditorías públicas →
        </Link>
      </div>
    </main>
  );
}
