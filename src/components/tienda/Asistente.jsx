'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// El asistente "del mostrador": burbujas con lo que explica al marcar y las respuestas de la IA, y debajo el
// ticket del pedido. Texto con **negrita** y saltos de línea, armado como elementos (sin HTML crudo).
function Texto({ texto }) {
  return String(texto).split('\n').map((linea, i) => (
    <p key={i} className={i ? 'mt-1.5' : ''}>
      {linea.split(/(\*\*[^*]+\*\*)/g).map((t, j) => (t.startsWith('**') && t.endsWith('**') ? <strong key={j} className="font-semibold">{t.slice(2, -2)}</strong> : t))}
    </p>
  ));
}

export default function Asistente({ mensajes, escribiendo, onEnviar, pedido, onPedir, sugerencias = [], onSugerencia }) {
  const [texto, setTexto] = useState('');
  const fin = useRef(null);
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [mensajes.length, escribiendo]);

  const enviar = (e) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || escribiendo) return;
    onEnviar(t);
    setTexto('');
  };

  return (
    <div className="flex flex-col h-full rounded-2xl border border-fg/10 bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-fg/10">
        <span className="relative h-9 w-9 rounded-full bg-accent-primary text-white grid place-items-center text-sm font-bold" aria-hidden>
          MA<span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[var(--t-card)]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg leading-tight">Asistente de Mariano</p>
          <p className="text-xs text-fg-500">Te explico cada cosa. Los precios los charlamos en la reunión.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3" aria-live="polite">
        <AnimatePresence initial={false}>
          {mensajes.map(m => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
              className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${m.rol === 'cliente'
                ? 'ml-auto bg-accent-primary text-white rounded-br-md'
                : 'bg-card-2 text-fg-200 rounded-bl-md'}`}>
              <Texto texto={m.texto} />
              {m.opciones && (
                <div className="flex gap-2 mt-2">
                  {m.opciones.map(o => (
                    <button key={o.label} type="button" onClick={o.accion}
                      className="text-xs font-semibold px-3 py-1 rounded-full border border-accent-primary/40 text-accent-primary hover:bg-accent-primary hover:text-white transition-colors">
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {escribiendo && (
          <div className="bg-card-2 rounded-2xl rounded-bl-md px-3.5 py-3 w-16 flex gap-1" aria-label="Escribiendo">
            {[0, 1, 2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-fg-500 animate-bounce" style={{ animationDelay: `${i * 0.12}s` }} />)}
          </div>
        )}
        {!escribiendo && sugerencias.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sugerencias.map(s => (
              <button key={s} type="button" onClick={() => onSugerencia(s)} className="text-xs px-2.5 py-1 rounded-full border border-fg/15 text-fg-300 hover:border-accent-primary hover:text-accent-primary">{s}</button>
            ))}
          </div>
        )}
        <div ref={fin} />
      </div>

      <form onSubmit={enviar} className="flex gap-2 px-3 py-3 border-t border-fg/10">
        <label htmlFor="asistente-input" className="sr-only">Escribí tu pregunta</label>
        <input id="asistente-input" value={texto} onChange={e => setTexto(e.target.value)} maxLength={1000}
          placeholder="Preguntame lo que quieras…" autoComplete="off"
          className="flex-1 min-w-0 rounded-xl border border-fg/15 bg-page px-3 py-2 text-sm text-fg placeholder:text-fg-500 focus:outline-2 focus:outline-accent-primary" />
        <button type="submit" disabled={!texto.trim() || escribiendo} className="rounded-xl bg-accent-primary text-white text-sm font-semibold px-4 disabled:opacity-40">Enviar</button>
      </form>

      {/* Ticket del pedido */}
      <div className="border-t-2 border-dashed border-fg/15 px-4 pt-3 pb-4 bg-page/60">
        <div className="flex items-baseline justify-between">
          <p className="font-[family-name:var(--font-ia-mono)] text-[11px] uppercase tracking-[0.18em] text-fg-500">Tu pedido</p>
          <p className="font-[family-name:var(--font-ia-mono)] text-xs text-fg-400 tabular-nums">{pedido.length} servicio{pedido.length === 1 ? '' : 's'}</p>
        </div>
        <ul className="mt-2 max-h-28 overflow-y-auto space-y-1 font-[family-name:var(--font-ia-mono)] text-[12px] text-fg-300">
          <AnimatePresence initial={false}>
            {pedido.map(s => (
              <motion.li key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="truncate">· {s.label}</motion.li>
            ))}
          </AnimatePresence>
          {!pedido.length && <li className="text-fg-500">Todavía nada. Marcá lo que te interese.</li>}
        </ul>
        <button type="button" onClick={onPedir} disabled={!pedido.length}
          className="mt-3 w-full rounded-xl bg-accent-primary text-white font-semibold py-2.5 hover:opacity-90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary">
          Pedir presupuesto
        </button>
      </div>
    </div>
  );
}
