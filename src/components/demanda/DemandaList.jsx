'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fecha = ms => new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
const select = 'px-3 py-2.5 rounded-xl bg-card border border-fg/10 text-fg text-sm focus:outline-none focus:border-indigo-500/60';

// Listado de informes con buscador (zona, localidad o rubro) + provincia + ciudad.
// Filtra los informes ya publicados: no consulta Google (eso es Analítica).
export default function DemandaList({ reportes }) {
  const [q, setQ] = useState('');
  const [provincia, setProvincia] = useState('');
  const [ciudad, setCiudad] = useState('');

  const provincias = useMemo(() => [...new Set(reportes.flatMap(r => r.provincias))].sort(), [reportes]);
  const ciudades = useMemo(() => [...new Set(
    reportes.filter(r => !provincia || r.provincias.includes(provincia)).flatMap(r => r.localidades),
  )].sort(), [reportes, provincia]);

  const visibles = useMemo(() => {
    const nq = norm(q.trim());
    return reportes.filter(r =>
      (!provincia || r.provincias.includes(provincia))
      && (!ciudad || r.localidades.includes(ciudad))
      && (!nq || [r.zona, ...r.localidades, ...r.rubros].some(t => norm(t).includes(nq))));
  }, [reportes, q, provincia, ciudad]);

  if (!reportes.length) {
    return (
      <div className="text-center py-20 text-fg-600">
        <p className="text-5xl mb-4">🔎</p>
        <p className="text-lg">Todavía no hay informes publicados.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <label className="sr-only" htmlFor="dm-q">Buscar</label>
        <input id="dm-q" type="search" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar rubro, zona o ciudad…" className={`${select} flex-1`} />
        <label className="sr-only" htmlFor="dm-prov">Provincia</label>
        <select id="dm-prov" value={provincia} className={select}
          onChange={e => { setProvincia(e.target.value); setCiudad(''); }}>
          <option value="">Todas las provincias</option>
          {provincias.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="sr-only" htmlFor="dm-ciudad">Ciudad</label>
        <select id="dm-ciudad" value={ciudad} onChange={e => setCiudad(e.target.value)} className={select}>
          <option value="">Todas las ciudades</option>
          {ciudades.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {visibles.length === 0 ? (
        <p className="text-fg-500 py-10 text-center">Ningún informe coincide con esos filtros.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {visibles.map(r => (
            <Link key={r.id} href={`/demanda/${r.id}/`}
              className="glow-frame block bg-card border border-fg/10 hover:border-indigo-500/40 rounded-2xl p-5 transition-colors group">
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h2 className="text-fg font-bold text-xl group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{r.zona}</h2>
                <span className="text-xs text-fg-600 shrink-0">{fecha(r.createdAtMs)}</span>
              </div>
              {r.localidades.length > 1 && <p className="text-xs text-fg-500 mb-3">{r.localidades.join(' · ')}</p>}
              <ol className="mt-3 space-y-1.5">
                {r.top3.map((label, i) => (
                  <li key={label} className="flex items-center gap-3 text-sm text-fg-300">
                    <span className="w-5 text-fg-600 tabular-nums text-right">{i + 1}</span>
                    <span className="font-medium text-fg">{label}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-indigo-600 dark:text-indigo-400">Ver los {r.rubros.length} rubros →</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
