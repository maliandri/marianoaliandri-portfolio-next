'use client';

import { useEffect, useState } from 'react';
import { IA_NICHOS } from '@/data/iaNichos';
import ToolReceipt from '@/components/iaPara/ToolReceipt';

// Demo del hero del home: la pregunta del equipo + el comprobante de /ia-para/ (ToolReceipt).
// Rota sola entre rubros hasta que el visitante toca uno. Datos ficticios.
const RUBROS = [
  { slug: 'constructoras',   label: 'Obras' },
  { slug: 'comercios',       label: 'Comercio' },
  { slug: 'automotor',       label: 'Taller' },
  { slug: 'salud-y-belleza', label: 'Consultorio' },
]
  .map(r => ({ ...r, nicho: IA_NICHOS.find(n => n.slug === r.slug) }))
  .filter(r => r.nicho?.respuesta);

const ROTACION_MS = 7000;

export default function ChatDemo() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI(x => (x + 1) % RUBROS.length), ROTACION_MS);
    return () => clearInterval(t);
  }, [auto]);

  if (!RUBROS.length) return null;
  const { nicho } = RUBROS[i];

  return (
    <div className="flex flex-col gap-4 w-full text-left">
      <div role="tablist" aria-label="Elegí un rubro" className="flex flex-wrap gap-1.5">
        {RUBROS.map((r, j) => (
          <button
            key={r.slug}
            type="button"
            role="tab"
            aria-selected={i === j}
            onClick={() => { setI(j); setAuto(false); }}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              i === j ? 'bg-indigo-600 text-white' : 'text-fg-500 hover:text-fg border border-fg/15'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* key: al cambiar de rubro se vuelve a "imprimir" el comprobante */}
      <div key={nicho.slug} className="flex flex-col gap-4" aria-live="polite">
        <p className="self-end max-w-[90%] bg-[#4c01f9] text-white text-[15px] font-medium px-4 py-3 rounded-[22px_22px_6px_22px]">
          {nicho.pregunta}
        </p>
        <ToolReceipt nicho={nicho} />
      </div>
    </div>
  );
}
