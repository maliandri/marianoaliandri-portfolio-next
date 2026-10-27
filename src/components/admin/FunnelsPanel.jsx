'use client';

import { useState, useEffect } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

// Embudos de conversión (GA4 vía /api/funnels/). Definición de pasos en src/data/funnels.js.
const PERIODOS = [7, 28, 90];
const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';

function Funnel({ embudo }) {
  const max = Math.max(1, embudo.pasos[0]?.personas || 0, ...embudo.pasos.map(p => p.personas));
  const final = embudo.pasos.at(-1);
  return (
    <div className={card}>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">{embudo.titulo}</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
          {final.pctInicio != null ? `${final.pctInicio}% llega al final` : 'sin visitas'}
        </span>
      </div>
      <ol className="space-y-3">
        {embudo.pasos.map((p, i) => (
          <li key={p.label}>
            <div className="flex justify-between text-sm mb-1 gap-3">
              <span className="text-gray-700 dark:text-gray-200">{i + 1}. {p.label}</span>
              <span className="tabular-nums text-gray-900 dark:text-white font-medium shrink-0">
                {p.personas.toLocaleString('es-AR')}
                {p.pctPrevio != null && (
                  <span className={`ml-2 text-xs font-normal ${p.pctPrevio < 20 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {p.pctPrevio}% del paso anterior
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.round((p.personas / max) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function FunnelsPanel() {
  const { getIdToken } = useAuthUser();
  const [days, setDays] = useState(28);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch(`/api/funnels/?days=${days}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
        if (!cancel) setData(json);
      } catch (e) {
        if (!cancel) setError(e.message);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [days, getIdToken]);

  return (
    <div className="space-y-5 max-w-4xl">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Embudos de conversión</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
              Personas (sin bots) que llegaron a cada paso, según Google Analytics. Los eventos de pasos
              intermedios se miden desde el 2026-10-27: antes de esa fecha aparecen en cero.
            </p>
          </div>
          <div className="flex gap-1" role="group" aria-label="Período">
            {PERIODOS.map(d => (
              <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${days === d
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                {d} días
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {data?.noData && <p className="text-sm text-amber-600">Falta GA4_PROPERTY_ID en el servidor.</p>}

      {data && !loading && !data.noData && (
        <>
          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Contactos</h3>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {data.contactos.map(c => (
                <div key={c.event}>
                  <dt className="text-xs text-gray-500 dark:text-gray-400">{c.label}</dt>
                  <dd className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{c.personas}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {data.embudos.map(e => <Funnel key={e.id} embudo={e} />)}
          </div>
        </>
      )}
    </div>
  );
}
