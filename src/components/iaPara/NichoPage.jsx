import Link from 'next/link';
import { IA_NICHOS, waLink } from '@/data/iaNichos';
import ToolReceipt from './ToolReceipt';
import { display, mono } from './fonts';
import s from './iaPara.module.css';

const FRENOS = [
  ['Solo entra tu equipo', 'Cada persona inicia sesión con su cuenta. Sin login, el conector no responde nada.'],
  ['Las acciones piden permiso', 'Antes de mandar, modificar o publicar, la IA te pregunta. Lo que repetís a diario lo podés dejar en "permitir siempre".'],
  ['Los límites están en el servidor', 'Topes de gasto, nada de mensajes duplicados y datos sensibles que nunca salen. No dependen de que la IA "se acuerde".'],
  ['Queda registro de todo', 'Cada cosa que hizo la IA queda anotada: qué pidió, cuándo y con qué resultado.'],
];

export default function NichoPage({ nicho }) {
  const consultas = nicho.tareas.filter(t => t.tipo === 'consulta');
  const acciones = nicho.tareas.filter(t => t.tipo === 'accion');
  const otros = IA_NICHOS.filter(n => n.slug !== nicho.slug);

  return (
    <main className={`${display.variable} ${mono.variable} bg-page text-fg`}>
      {/* La tesis: la pregunta que hace el equipo y lo que la IA consulta en su sistema. */}
      <section className="max-w-6xl mx-auto px-4 pt-28 pb-16 grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr] lg:items-center [&>*]:min-w-0">
        <div>
          <p className="text-sm font-semibold text-fg-500 mb-5">
            <Link href="/ia-para/" className="hover:text-fg focus-visible:outline-2 focus-visible:outline-[#4c01f9] rounded">IA para empresas</Link>
            <span aria-hidden="true"> / </span>{nicho.titulo}
          </p>
          <p className="text-fg-400 mb-3">Tu equipo le pregunta a la IA:</p>
          <h1 className={`${s.display} ${s.bubble} inline-block px-6 py-5 text-[28px] sm:text-[38px] leading-[1.08] font-bold tracking-[-0.02em]`}>
            {nicho.pregunta}
          </h1>
          <p className="mt-6 text-lg text-fg-300 leading-relaxed max-w-xl">
            Y la IA responde con los datos de <strong className="text-fg">tu</strong> sistema, no con lo que encuentra en internet.
            Conecto la IA a lo que ya usan en {nicho.nombre}: {nicho.sistemas.join(', ')}.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={waLink(nicho)} target="_blank" rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl bg-[#4c01f9] text-white font-semibold hover:bg-[#3d00c8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c01f9]">
              Contame qué sistema usás
            </a>
            <Link href="/presupuesto/"
              className="px-5 py-3 rounded-xl border border-fg-600/50 font-semibold hover:bg-card-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c01f9]">
              Pedir presupuesto
            </Link>
          </div>
        </div>
        <ToolReceipt nicho={nicho} />
      </section>

      {/* Lo que puede pedir el equipo: consultas (solo leen) y acciones (piden aprobación). */}
      <section className="max-w-6xl mx-auto px-4 py-16 border-t border-fg-600/20">
        <h2 className={`${s.display} text-3xl sm:text-4xl font-bold tracking-tight mb-10`}>Lo que tu equipo le puede pedir</h2>
        <div className="grid gap-10 md:grid-cols-2">
          {[['Preguntas', 'Solo leen tus datos.', consultas], ['Acciones', 'Te piden permiso antes de hacerlas.', acciones]].map(([t, sub, items]) => (
            <div key={t}>
              <h3 className="text-lg font-semibold">{t}</h3>
              <p className="text-sm text-fg-500 mb-4">{sub}</p>
              <ul className="space-y-3">
                {items.map(it => (
                  <li key={it.texto} className="rounded-2xl bg-card border border-fg-600/20 px-5 py-4 text-fg-200 leading-relaxed">
                    “{it.texto}”
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* El proceso real, en orden. */}
      <section className="max-w-6xl mx-auto px-4 py-16 border-t border-fg-600/20">
        <h2 className={`${s.display} text-3xl sm:text-4xl font-bold tracking-tight mb-10`}>Cómo se arma</h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {[
            ['Vemos qué se repite', `Qué preguntas y tareas le ocupan tiempo a tu equipo, y dónde están esos datos (${nicho.sistemas[0]}, ${nicho.sistemas[1]}).`],
            ['Armo el conector', 'Un servidor seguro que le da a la IA herramientas concretas sobre tu sistema: consultar, crear, avisar. Nada más que eso.'],
            ['Tu equipo lo usa', 'Desde Claude en la compu o en el celular, incluso dictando. Sin instalar nada nuevo en el negocio.'],
          ].map(([t, d], i) => (
            <li key={t}>
              <span className={`${s.mono} text-sm text-[#4c01f9] dark:text-[#a78bfa]`}>paso {i + 1}</span>
              <h3 className="mt-2 text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-fg-400 leading-relaxed">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16 border-t border-fg-600/20">
        <h2 className={`${s.display} text-3xl sm:text-4xl font-bold tracking-tight mb-3`}>Con frenos</h2>
        <p className="text-fg-400 mb-10 max-w-2xl">La IA trabaja con tus datos, así que lo importante es lo que no puede hacer.</p>
        <dl className="grid gap-x-10 gap-y-8 md:grid-cols-2">
          {FRENOS.map(([t, d]) => (
            <div key={t}>
              <dt className="font-semibold">{t}</dt>
              <dd className="mt-1 text-fg-400 leading-relaxed">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 text-fg-300 max-w-2xl">
          Lo uso todos los días en mi propio negocio: desde el celular le pido a la IA que busque clientes, arme informes y los publique.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-16 border-t border-fg-600/20">
        <h2 className={`${s.display} text-3xl sm:text-4xl font-bold tracking-tight mb-4`}>¿Qué le preguntaría tu equipo?</h2>
        <p className="text-fg-400 mb-8 max-w-2xl">Contame qué sistema usan y qué tareas les quitan más tiempo. Te digo qué se puede conectar y cómo.</p>
        <div className="flex flex-wrap gap-3">
          <a href={waLink(nicho)} target="_blank" rel="noopener noreferrer"
            className="px-5 py-3 rounded-xl bg-[#4c01f9] text-white font-semibold hover:bg-[#3d00c8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c01f9]">
            Escribime por WhatsApp
          </a>
          <Link href="/presupuesto/"
            className="px-5 py-3 rounded-xl border border-fg-600/50 font-semibold hover:bg-card-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c01f9]">
            Pedir presupuesto
          </Link>
        </div>

        <nav aria-label="Otros rubros" className="mt-16">
          <p className="text-sm text-fg-500 mb-3">También para</p>
          <ul className="flex flex-wrap gap-2">
            {otros.map(n => (
              <li key={n.slug}>
                <Link href={`/ia-para/${n.slug}/`} className="inline-block px-3 py-1.5 rounded-full border border-fg-600/40 text-sm hover:bg-card-2 focus-visible:outline-2 focus-visible:outline-[#4c01f9]">
                  {n.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </section>
    </main>
  );
}
