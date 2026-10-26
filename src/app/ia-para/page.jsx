import Link from 'next/link';
import { IA_NICHOS, waLink } from '@/data/iaNichos';
import { display, mono } from '@/components/iaPara/fonts';
import s from '@/components/iaPara/iaPara.module.css';

const PAGE_URL = 'https://marianoaliandri.com.ar/ia-para/';
const DESC = 'Conecto la IA al sistema que ya usa tu empresa: tu equipo le pregunta y la IA responde y actúa con tus datos reales, con permisos y registro de todo.';

export const metadata = {
  title: 'IA para empresas: tu sistema conectado a la IA',
  description: DESC,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website', url: PAGE_URL, title: 'IA para empresas: tu sistema conectado a la IA', description: DESC,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
};

export default function IaParaPage() {
  return (
    <main className={`${display.variable} ${mono.variable} bg-page text-fg`}>
      <section className="max-w-6xl mx-auto px-4 pt-28 pb-14">
        <p className="text-sm font-semibold text-fg-500 mb-5">IA para empresas</p>
        <h1 className={`${s.display} max-w-4xl text-[40px] sm:text-[64px] leading-[1.02] font-extrabold tracking-[-0.03em]`}>
          Tu sistema, conectado a la IA.
        </h1>
        <p className="mt-6 text-lg text-fg-300 leading-relaxed max-w-2xl">
          Tu equipo le pregunta a la IA en sus palabras, desde la compu o el celular, y la IA responde y actúa con los datos
          de tu negocio: tus planillas, tu stock, tus turnos, tus clientes. Con login, permisos y registro de cada cosa que hace.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={waLink(null)} target="_blank" rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl bg-[#4c01f9] text-white font-semibold hover:bg-[#3d00c8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c01f9]">
            Contame qué sistema usás
          </a>
          <Link href="/presupuesto/"
            className="px-5 py-3 rounded-xl border border-fg-600/50 font-semibold hover:bg-card-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c01f9]">
            Pedir presupuesto
          </Link>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20" aria-labelledby="rubros">
        <h2 id="rubros" className="text-sm font-semibold text-fg-500 mb-5">Elegí tu rubro y mirá lo que le preguntaría tu equipo</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IA_NICHOS.map(n => (
            <li key={n.slug}>
              <Link href={`/ia-para/${n.slug}/`}
                className="group flex h-full flex-col justify-between gap-6 rounded-2xl bg-card border border-fg-600/20 p-6 hover:border-[#4c01f9]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c01f9]">
                <p className={`${s.display} text-xl leading-snug font-semibold`}>“{n.pregunta}”</p>
                <span className="flex flex-col gap-1 text-sm">
                  <span className="text-fg-400">{n.titulo}</span>
                  <span className={`${s.mono} text-[#4c01f9] dark:text-[#a78bfa] group-hover:translate-x-0.5 transition-transform`}>{n.herramienta}() →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
