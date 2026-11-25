'use client';

import { RECETAS } from '@/data/tiendaRecetas';

// La "vidriera": servicios agrupados por objetivo, cada uno con su para qué sirve en una línea y un checkbox.
// Lo que se suma solo por dependencia se marca "incluido" y no se puede sacar a mano.
export default function ListaServicios({ grupos, marcados, agregadosPor, onToggle, onPreguntar, onReceta }) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-fg-400 mr-1">¿No sabés por dónde arrancar?</span>
        {RECETAS.map(r => (
          <button key={r.label} type="button" onClick={() => onReceta(r)}
            className="px-3.5 py-1.5 rounded-full border border-fg/15 text-sm text-fg-200 hover:border-accent-primary hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-accent-primary transition-colors">
            {r.label}
          </button>
        ))}
      </div>

      {grupos.map(g => (
        <section key={g.id} aria-labelledby={`g-${g.id}`}>
          <h2 id={`g-${g.id}`} className="font-[family-name:var(--font-ia-display)] text-xl md:text-2xl font-bold text-fg mb-3 flex items-baseline gap-2">
            <span aria-hidden>{g.emoji}</span>{g.label}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {g.items.map(s => {
              const on = marcados.has(s.id);
              const por = agregadosPor[s.id];
              return (
                <li key={s.id}>
                  <div className={`h-full flex gap-3 rounded-xl border px-4 py-3 transition-colors ${on ? 'border-accent-primary/60 bg-accent-primary/[0.06]' : 'border-fg/10 bg-card hover:border-fg/25'}`}>
                    <input id={`s-${s.id}`} type="checkbox" checked={on} disabled={!!por} onChange={() => onToggle(s.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#4c01f9] cursor-pointer disabled:cursor-not-allowed" />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={`s-${s.id}`} className="block font-medium text-fg leading-snug cursor-pointer">{s.label}</label>
                      <p className="text-sm text-fg-500 leading-snug mt-0.5">{s.benefit || s.desc}</p>
                      <div className="flex flex-wrap items-center gap-x-3 mt-1.5">
                        {por && <span className="text-xs text-accent-primary">Incluido: lo necesita {por}</span>}
                        <button type="button" onClick={() => onPreguntar(s)} className="text-xs text-fg-500 underline decoration-dotted underline-offset-2 hover:text-accent-primary">
                          ¿Qué es esto?
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
