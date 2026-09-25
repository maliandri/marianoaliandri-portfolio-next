'use client';

import { useState } from 'react';
import Link from 'next/link';

// Hero + features de la landing de Lead Finder Pro con toggle de audiencia.
// "dev" es el default (lo que se renderiza en el HTML del servidor); "empresa" explica
// para qué le sirve la herramienta a un negocio que vende un producto (mismos dos perfiles
// que el panel de búsqueda, ver CustomerLeadFinderPanel).
const COPY = {
  es: {
    toggleLabel: '¿Para qué lo vas a usar?',
    demoHref: '/lead-finder-pro/demo',
    cta: 'Probar gratis',
    ctaHint: 'Sin tarjeta. Ves una auditoría real completa.',
    dev: {
      toggle: 'Soy dev / agencia',
      eyebrow: 'Para devs y agencias',
      title: ['Encontrá negocios sin sitio', 'o con SEO débil'],
      body: 'En vez de salir a golpear puertas a ciegas, elegís una zona — localidad, provincia o todo el país — y qué tipo de negocio buscás, y te devolvemos la lista completa de negocios reales de Google Maps: si tienen sitio web o no (los que no tienen son el lead más caliente), score SEO de 0 a 100, teléfono, horarios y rating listos para armar tu lista de contacto, con mapa y tabla ordenable para priorizar por zona o por qué tan débil está su presencia digital. Es la misma herramienta que uso yo para conseguir mis propios clientes — ahora la podés usar vos para conseguir los tuyos.',
      features: [
        { icon: '🗺️', title: 'Mapa en vivo', desc: 'Ubicación, distancia y estado de cada negocio de la zona que elijas.' },
        { icon: '📊', title: 'Score SEO por negocio', desc: 'Sitemap, robots.txt, meta description, Open Graph y antigüedad del sitio.' },
        { icon: '☎️', title: 'Teléfono, horarios y rating', desc: 'Datos de contacto listos para armar tu lista de prospección.' },
        { icon: '📍', title: 'Por localidad, provincia o país', desc: 'Elegí el alcance según lo que necesites auditar.' },
      ],
    },
    empresa: {
      toggle: 'Soy empresa que vende un producto',
      eyebrow: 'Para empresas que venden un producto',
      title: ['Mirá cómo compite tu rubro,', 'comercio por comercio'],
      body: 'Si vendés un producto — celulares, muebles, repuestos, lo que sea — elegís una zona y tu rubro, y te devolvemos los comercios reales de Google Maps que lo venden: teléfono, sitio web, email de contacto, cuándo actualizaron su sitio por última vez y un estimado de cuántos productos publican. Así sabés quién está activo y quién está dormido, dónde está tu competencia y a quién le podés ofrecer tu producto como proveedor o revendedor. Y con los resultados armás un mail masivo en copia oculta (CCO) para escribirles a todos de una, desde tu propio correo.',
      features: [
        { icon: '🏪', title: 'Los comercios de tu rubro', desc: 'Todos los negocios de la zona que vendan lo que vos vendés, con mapa y tabla ordenable.' },
        { icon: '🔢', title: 'Cuántos productos publican', desc: 'Contamos cuántos productos de tu rubro tiene cada sitio: del catálogo real o estimado por sus páginas.' },
        { icon: '🕒', title: 'Qué tan activos están', desc: 'Fecha de la última actualización de cada sitio. Marcamos los desactualizados (más de 18 meses).' },
        { icon: '✉️', title: 'Mail masivo en CCO', desc: 'Email de contacto de cada comercio y un mensaje en copia oculta para llegarles a todos al instante.' },
      ],
    },
  },
  en: {
    toggleLabel: 'What will you use it for?',
    demoHref: '/en/lead-finder-pro/demo',
    cta: 'Try it free',
    ctaHint: 'No card required. See a real, complete audit.',
    dev: {
      toggle: 'I’m a dev / agency',
      eyebrow: 'For devs & agencies',
      title: ['Find businesses with no website', 'or weak SEO'],
      body: 'Instead of knocking on doors blind, you pick an area — city, state/province or a whole country — and what kind of business you’re looking for, and we return the full list of real businesses from Google Maps: whether they have a website or not (the ones without one are the hottest lead), an SEO score from 0 to 100, phone, hours and rating ready to build your contact list, with a map and a sortable table to prioritize by area or by how weak their digital presence is. It’s the same tool I use to land my own clients — now you can use it to land yours.',
      features: [
        { icon: '🗺️', title: 'Live map', desc: 'Location, distance and status of every business in the area you pick.' },
        { icon: '📊', title: 'SEO score per business', desc: 'Sitemap, robots.txt, meta description, Open Graph and site age.' },
        { icon: '☎️', title: 'Phone, hours and rating', desc: 'Contact info ready to build your prospecting list.' },
        { icon: '📍', title: 'By city, state/province or country', desc: 'Pick the coverage that fits what you need to audit.' },
      ],
    },
    empresa: {
      toggle: 'I’m a company that sells a product',
      eyebrow: 'For companies that sell a product',
      title: ['See how your market competes,', 'business by business'],
      body: 'If you sell a product — phones, furniture, spare parts, anything — you pick an area and your niche, and we return the real Google Maps businesses that sell it: phone, website, contact email, when their site was last updated and an estimate of how many products they list. So you know who is active and who is asleep, where your competition is and who you could offer your product to as a supplier or reseller. Then you build a bulk email in BCC from the results and write to all of them at once, from your own inbox.',
      features: [
        { icon: '🏪', title: 'The businesses in your niche', desc: 'Every business in the area that sells what you sell, with a map and a sortable table.' },
        { icon: '🔢', title: 'How many products they list', desc: 'We count how many products in your niche each site has: from the real catalog, or estimated from its pages.' },
        { icon: '🕒', title: 'How active they are', desc: 'Last update date of each site. We flag the outdated ones (more than 18 months).' },
        { icon: '✉️', title: 'Bulk email in BCC', desc: 'Each business’s contact email and a blind-copy message to reach all of them instantly.' },
      ],
    },
  },
};

const PROFILES = ['dev', 'empresa'];

export default function AudienceHero({ lang = 'es' }) {
  const [perfil, setPerfil] = useState('dev');
  const c = COPY[lang] || COPY.es;
  const p = c[perfil];

  return (
    <>
      <div className="max-w-4xl mx-auto text-center mb-14">
        <div
          role="radiogroup"
          aria-label={c.toggleLabel}
          className="inline-flex flex-col sm:flex-row p-1 mb-8 gap-1 bg-[#111] border border-white/10 rounded-2xl sm:rounded-full"
        >
          {PROFILES.map(id => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={perfil === id}
              onClick={() => setPerfil(id)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${perfil === id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-gray-200'}`}
            >
              {c[id].toggle}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">{p.eyebrow}</p>
        <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-5">
          {p.title[0]}<br className="hidden sm:block" /> {p.title[1]}
        </h1>
        <p className="text-gray-400 text-base max-w-xl mx-auto mb-8">{p.body}</p>
        <Link
          href={c.demoHref}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-7 py-3.5 rounded-xl transition-colors"
        >
          {c.cta} <span aria-hidden>→</span>
        </Link>
        <p className="text-xs text-gray-600 mt-3">{c.ctaHint}</p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
        {p.features.map(f => (
          <div key={f.title} className="bg-[#111] border border-white/10 rounded-2xl p-6">
            <div className="text-2xl mb-3" aria-hidden>{f.icon}</div>
            <h3 className="text-white font-semibold mb-1.5">{f.title}</h3>
            <p className="text-gray-500 text-sm">{f.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}
