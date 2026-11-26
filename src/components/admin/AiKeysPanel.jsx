'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/utils/adminFetch';

// Admin → Marketing → Claves de IA: estado en vivo de cada clave de Gemini y Groq (/api/ai-keys/).
const ESTADOS = {
  ok:                   { txt: 'Anda',                 cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  cuota:                { txt: 'Sin cuota',            cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400' },
  saturado:             { txt: 'Modelo saturado',      cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
  colgada:              { txt: 'No responde',          cls: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
  invalida:             { txt: 'Inválida',             cls: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  bloqueada:            { txt: 'Bloqueada',            cls: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
  modelo_no_disponible: { txt: 'Modelo no habilitado', cls: 'bg-gray-100 text-gray-700 dark:bg-neutral-800 dark:text-gray-300' },
  error:                { txt: 'Error',                cls: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
};

function Estado({ p }) {
  const e = ESTADOS[p.estado] || ESTADOS.error;
  return (
    <span title={p.detalle || ''} className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${e.cls}`}>
      {e.txt}{typeof p.ms === 'number' && <span className="font-normal opacity-70 tabular-nums">{(p.ms / 1000).toFixed(1)} s</span>}
    </span>
  );
}

export default function AiKeysPanel() {
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const probar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const res = await adminFetch('/api/ai-keys/');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`);
      setData(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { probar(); }, [probar]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Claves de IA</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Prueba en vivo cada clave de Gemini (con cada modelo de la cadena) y la de Groq, con un pedido mínimo.
            Se usan en este orden: las satélite primero, la compartida y la de Firebase al final.
          </p>
        </div>
        <button onClick={probar} disabled={cargando}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
          {cargando ? 'Probando…' : 'Probar de nuevo'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Claves cargadas', data.resumen.total, 'text-gray-900 dark:text-white'],
              ['Andan', data.resumen.andan, 'text-emerald-600 dark:text-emerald-400'],
              ['No anda ningún modelo', data.resumen.sinNinguna, data.resumen.sinNinguna ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'],
              ['Repetidas', data.resumen.duplicadas, 'text-gray-900 dark:text-white'],
            ].map(([l, v, c]) => (
              <div key={l} className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                <p className={`text-2xl font-bold tabular-nums ${c}`}>{v}</p>
                <p className="text-xs text-gray-500 mt-0.5">{l}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/40">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500">Variable</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500">Termina en</th>
                  {data.modelos.map(m => (
                    <th key={m} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 whitespace-nowrap">{m}</th>
                  ))}
                  <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500">Groq</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                {data.claves.map(c => (
                  <tr key={c.nombre}>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-900 dark:text-white whitespace-nowrap">{c.nombre}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">…{c.final}</td>
                    {c.duplicadaDe ? (
                      <td colSpan={data.modelos.length + 1} className="px-4 py-2.5 text-xs text-gray-500">Igual a {c.duplicadaDe} (no se prueba dos veces)</td>
                    ) : c.proveedor === 'groq' ? (
                      <>
                        {data.modelos.map(m => <td key={m} className="px-4 py-2.5 text-gray-300">—</td>)}
                        <td className="px-4 py-2.5"><Estado p={c.pruebas[0]} /></td>
                      </>
                    ) : (
                      <>
                        {data.modelos.map(m => {
                          const p = c.pruebas.find(x => x.modelo === m);
                          return <td key={m} className="px-4 py-2.5">{p ? <Estado p={p} /> : '—'}</td>;
                        })}
                        <td className="px-4 py-2.5 text-gray-300">—</td>
                      </>
                    )}
                  </tr>
                ))}
                {!data.claves.length && (
                  <tr><td colSpan={data.modelos.length + 3} className="px-4 py-6 text-center text-gray-500">No hay ninguna clave de IA cargada en este entorno.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400">
            Pasá el mouse sobre un estado para ver el mensaje del proveedor. Probado {new Date(data.probadoEn).toLocaleString('es-AR')}.
            Las claves de GitHub Actions (bot, reels, auditoría automática) son secrets aparte: esta pantalla ve las de Vercel.
          </p>
        </>
      )}
    </div>
  );
}
