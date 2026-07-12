import Link from 'next/link';

export const metadata = {
  title: 'Preguntas frecuentes — Desarrollo web & servicios digitales | Mariano Aliandri',
  description: 'Respondemos las preguntas más comunes sobre desarrollo web, tiendas online, SEO, automatizaciones y presencia digital para comercios y empresas en Neuquén / Comahue.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/faq/' },
  openGraph: {
    title: 'FAQ — Desarrollo web en Neuquén | Mariano Aliandri',
    description: 'Todo lo que necesitás saber antes de contratar un desarrollador web en Neuquén.',
    url: 'https://marianoaliandri.com.ar/faq/',
  },
};

const FAQS = [
  {
    category: '🌐 Desarrollo web',
    items: [
      {
        q: '¿Cuánto cuesta hacer un sitio web en Neuquén?',
        a: 'Depende del tipo de proyecto. Una landing page de conversión arranca desde USD 300. Un sitio multipágina con SEO, formularios y blog está entre USD 600 y USD 1.200. Una tienda online con carrito y pagos online (MercadoPago) parte desde USD 1.000. Todos los proyectos incluyen diseño mobile-first, optimización de velocidad y entrega en Vercel con dominio configurado.',
      },
      {
        q: '¿Cuánto tiempo tarda en hacerse un sitio web?',
        a: 'Una landing page tarda entre 5 y 10 días hábiles. Un sitio multipágina completo entre 2 y 4 semanas. Una tienda online o web app entre 4 y 8 semanas, dependiendo de las funcionalidades. El plazo se define antes de empezar y se respeta.',
      },
      {
        q: '¿Qué tecnologías usás para desarrollar sitios web?',
        a: 'El stack principal es Next.js 15 con React 19, Tailwind CSS, Firebase para base de datos y autenticación, y deploy en Vercel. Para tiendas online integro MercadoPago. Para automatizaciones uso Make.com y Gemini AI. Es el mismo stack que usan empresas como Vercel, Linear y Notion.',
      },
      {
        q: '¿Podés hacer el sitio web para mi empresa constructora o de servicios petroleros?',
        a: 'Sí, es uno de mis nichos principales en la región. Trabajo con constructoras, estudios de arquitectura, empresas de servicios para Vaca Muerta y proveedores industriales del Comahue. Los sitios incluyen presentación de proyectos, catálogo de servicios, formulario de contacto y SEO local.',
      },
      {
        q: '¿Incluís hosting y dominio en el precio?',
        a: 'El deploy en Vercel (hosting) está incluido en el precio de desarrollo. El dominio (.com.ar o .com) se registra aparte y tiene un costo aproximado de USD 10-15 por año. La configuración de DNS, email profesional y SSL están incluidos.',
      },
    ],
  },
  {
    category: '🛒 Tiendas online & e-commerce',
    items: [
      {
        q: '¿Puedo vender online siendo un comercio de Neuquén?',
        a: 'Sí. Desarrollo tiendas online con catálogo de productos, carrito de compras y checkout integrado con MercadoPago para pagos con tarjeta, transferencia y billeteras virtuales. También integro WhatsApp como canal de ventas directo.',
      },
      {
        q: '¿Cuál es la diferencia entre una landing page y un sitio web completo?',
        a: 'Una landing page es una página única orientada a convertir visitas en clientes (consultas, presupuestos, llamadas). Un sitio web completo tiene múltiples páginas (servicios, proyectos, sobre mí, contacto, blog). Para comercios que recién empiezan online, la landing page es la opción más rápida y efectiva.',
      },
      {
        q: '¿Puedo alquilar el sitio web en lugar de comprarlo?',
        a: 'Sí, ofrezco un modelo de alquiler mensual que incluye el sitio web desarrollado, hosting, mantenimiento y actualizaciones. Ideal para negocios que quieren presencia online sin una inversión inicial grande. Al finalizar el contrato, podés quedarte con el sitio pagando la diferencia.',
      },
    ],
  },
  {
    category: '🔍 SEO & posicionamiento',
    items: [
      {
        q: '¿Qué es el SEO y por qué lo necesita mi negocio en Neuquén?',
        a: 'SEO (Search Engine Optimization) es el conjunto de técnicas para que tu sitio aparezca en Google cuando alguien busca tus servicios. Por ejemplo: "arquitecto Neuquén", "taller mecánico Cipolletti" o "tienda de electrodomésticos Roca". Sin SEO, tu sitio existe pero nadie lo encuentra.',
      },
      {
        q: '¿Cuánto tiempo tarda en verse el resultado del SEO?',
        a: 'El SEO técnico (velocidad, estructura, metadatos) se ve en 2-4 semanas. El posicionamiento en resultados de búsqueda tarda entre 3 y 6 meses en consolidarse. Los resultados dependen de la competencia en tu rubro y zona. Ofrezco un reporte mensual de posiciones con Google Search Console.',
      },
      {
        q: '¿Aparecerá mi negocio en ChatGPT o en la IA de Google?',
        a: 'Los modelos de IA como ChatGPT, Perplexity y Google AI Overview citan sitios que tienen contenido estructurado, respuestas claras a preguntas frecuentes y buena autoridad web. Todos los sitios que desarrollo incluyen schema markup (JSON-LD), FAQ optimizado y configuración para que los bots de IA puedan rastrear el contenido.',
      },
    ],
  },
  {
    category: '🤖 IA & automatizaciones',
    items: [
      {
        q: '¿Podés integrar inteligencia artificial en mi sitio web o negocio?',
        a: 'Sí. Integro Gemini AI (Google) para chatbots entrenados con información de tu negocio, generación automática de contenido, análisis de documentos y automatización de respuestas. También conecto Make.com para automatizar publicaciones en redes sociales, notificaciones y flujos de trabajo.',
      },
      {
        q: '¿Qué es el Lead Finder y cómo puede ayudar a mi empresa?',
        a: 'El Lead Finder es una herramienta que desarrollé para encontrar potenciales clientes en Google Maps dentro de una zona específica (Neuquén, Comahue o cualquier ciudad de Argentina), analizar su presencia web y contactarlos con emails personalizados generados por IA. Ideal para empresas que quieren escalar su prospección.',
      },
    ],
  },
  {
    category: '📊 Analítica & datos',
    items: [
      {
        q: '¿Podés hacer un dashboard de datos para mi empresa?',
        a: 'Sí. Desarrollo dashboards con Recharts y Firebase que muestran KPIs en tiempo real, ventas, tráfico web, posiciones en Google y cualquier dato que tu empresa necesite visualizar. También trabajo con Google Sheets como fuente de datos y exportación a Excel/PDF.',
      },
      {
        q: '¿Qué es Google Search Console y por qué importa?',
        a: 'Google Search Console es la herramienta gratuita de Google que muestra exactamente qué palabras busca la gente para llegar a tu sitio, cuántas veces aparecés y cuántos entran. Es la base para cualquier estrategia SEO. Todos mis proyectos incluyen la configuración y verificación de GSC.',
      },
    ],
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.flatMap(cat =>
    cat.items.map(item => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    }))
  ),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
        <div className="max-w-3xl mx-auto px-4">

          {/* Header */}
          <div className="mb-12">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Preguntas frecuentes</p>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
              Todo lo que necesitás saber
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Respondemos las consultas más comunes sobre desarrollo web, tiendas online, SEO y
              automatizaciones para empresas y comercios de <span className="text-white">Neuquén / Comahue</span>.
            </p>
          </div>

          {/* FAQ por categoría */}
          <div className="space-y-10">
            {FAQS.map(cat => (
              <section key={cat.category}>
                <h2 className="text-sm font-bold text-indigo-400 uppercase tracking-widest mb-4">
                  {cat.category}
                </h2>
                <div className="space-y-3">
                  {cat.items.map((item, i) => (
                    <details
                      key={i}
                      className="group bg-[#111] border border-white/8 rounded-2xl overflow-hidden open:border-indigo-500/30"
                    >
                      <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer list-none hover:bg-white/3 transition-colors">
                        <h3 className="text-sm font-semibold text-white leading-snug">{item.q}</h3>
                        <svg
                          className="w-4 h-4 text-gray-500 shrink-0 transition-transform group-open:rotate-180"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-6 pb-5 pt-1">
                        <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-8 text-center">
            <p className="text-white font-bold text-lg mb-2">¿No encontraste tu respuesta?</p>
            <p className="text-gray-400 text-sm mb-6">
              Contame tu proyecto y te respondo en menos de 24hs.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/presupuesto"
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Pedir presupuesto gratis
              </Link>
              <Link
                href="/#contact"
                className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold rounded-xl transition-colors border border-white/10"
              >
                Contacto directo
              </Link>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
