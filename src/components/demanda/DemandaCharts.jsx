// Gráficos de los informes de demanda (server components, sin JS en el cliente).
// Barras: una sola serie (sin leyenda), valor rotulado en cada fila. Heatmap: escala secuencial
// de un solo tono (azul), con su propia escala en modo oscuro; el número va en cada celda, así
// el color nunca es la única forma de leerlo. Tooltip nativo (title) por marca.

function Cambio({ r }) {
  if (r.nuevo) return <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">nuevo</span>;
  if (r.cambio === null || r.cambio === undefined) return null;
  if (r.cambio === 0) return <span className="text-xs text-fg-600" title="Mismo puesto que el informe anterior">=</span>;
  const sube = r.cambio > 0;
  const n = Math.abs(r.cambio);
  return (
    <span className={`text-xs font-semibold tabular-nums ${sube ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}
      title={`${sube ? 'Subió' : 'Bajó'} ${n} ${n === 1 ? 'puesto' : 'puestos'}`}>
      {sube ? '▲' : '▼'}{n}
    </span>
  );
}

export function RankingBars({ top }) {
  return (
    <ol className="space-y-2">
      {top.map(r => (
        <li key={r.id} title={`${r.label}: índice ${r.interes}`} data-grupo={r.pos <= 10 ? 'a' : 'b'}
          className="grid grid-cols-[1.5rem_minmax(6rem,11rem)_1fr_2rem_2.25rem] items-center gap-2 sm:gap-3 text-sm">
          <span className="text-fg-600 tabular-nums text-right">{r.pos}</span>
          <span className="text-fg font-medium truncate">{r.label}</span>
          <span className="h-3 bg-fg/5 rounded-r">
            <span className="block h-full rounded-r bg-indigo-500" style={{ width: `${Math.max(2, r.interes)}%` }} />
          </span>
          <span className="text-fg-300 tabular-nums text-right">{r.interes}</span>
          <span className="text-right"><Cambio r={r} /></span>
        </li>
      ))}
    </ol>
  );
}

// Pasos de la escala azul de referencia: en claro, más demanda = más oscuro; en oscuro, al revés
// (lo bajo se funde con el fondo). Clases completas para que Tailwind las genere.
const STEPS = [
  'bg-[#cde2fb] text-[#0d366b] dark:bg-[#0d366b] dark:text-[#cde2fb]',
  'bg-[#86b6ef] text-[#0d366b] dark:bg-[#1c5cab] dark:text-white',
  'bg-[#3987e5] text-white dark:bg-[#2a78d6] dark:text-white',
  'bg-[#1c5cab] text-white dark:bg-[#5598e7] dark:text-[#0d366b]',
  'bg-[#0d366b] text-white dark:bg-[#9ec5f4] dark:text-[#0d366b]',
];
const step = v => (v <= 0 ? 'bg-fg/5 text-fg-600' : STEPS[Math.min(4, Math.floor(v / 20))]);

export function LocalidadHeatmap({ top, localidades }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th scope="col" className="text-left font-medium text-fg-500 pr-2 pb-1">Rubro</th>
            {localidades.map(l => (
              <th key={l} scope="col" className="font-medium text-fg-500 pb-1 px-1 min-w-14 align-bottom">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {top.map(r => {
            const por = new Map((r.porLocalidad || []).map(p => [p.localidad, p.interes]));
            return (
              <tr key={r.id}>
                <th scope="row" className="text-left font-medium text-fg pr-2 whitespace-nowrap">{r.label}</th>
                {localidades.map(l => {
                  const v = por.get(l) ?? 0;
                  return (
                    <td key={l} title={`${r.label} en ${l}: ${v}`}
                      className={`text-center tabular-nums rounded py-1.5 ${step(v)}`}>{v}</td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
