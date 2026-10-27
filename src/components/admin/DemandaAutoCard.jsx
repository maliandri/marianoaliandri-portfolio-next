'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { PROVINCIAS_AR } from '@/data/localidadesAR';

// Informes de demanda automáticos (/demanda + LinkedIn). Lógica en src/lib/demandaAutoRun.js.
const ESTADO_STYLE = {
  ok: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  guardado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  sin_datos: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  post_fallido: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';
const input = 'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100';

function ZonaEditor({ zona, onChange, onDelete, onRun, busy }) {
  const [prov, setProv] = useState('');
  const [loc, setLoc] = useState('');
  const localidades = PROVINCIAS_AR.find(p => p.provincia === prov)?.localidades || [];

  const add = () => {
    if (!prov || !loc) return;
    if (zona.localidades.some(l => l.provincia === prov && l.localidad === loc)) return;
    onChange({ ...zona, localidades: [...zona.localidades, { provincia: prov, localidad: loc }] });
    setLoc('');
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="font-semibold text-gray-900 dark:text-white">{zona.nombre}</span>
        <span className="flex gap-3 text-xs">
          <button disabled={busy} onClick={() => onRun(zona.id, false)} className="underline text-gray-600 dark:text-gray-300 disabled:opacity-50">
            Probar sin publicar
          </button>
          <button disabled={busy} onClick={onDelete} className="underline text-red-600 disabled:opacity-50">Eliminar zona</button>
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {zona.localidades.map(l => (
          <span key={`${l.provincia}|${l.localidad}`} className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded-full">
            {l.provincia} — {l.localidad}
            <button disabled={busy || zona.localidades.length <= 1} aria-label={`Quitar ${l.localidad}`}
              onClick={() => onChange({ ...zona, localidades: zona.localidades.filter(x => x !== l) })}
              className="text-gray-500 hover:text-red-600 disabled:opacity-30">×</button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Provincia" className={input} value={prov} onChange={e => { setProv(e.target.value); setLoc(''); }}>
          <option value="">Provincia…</option>
          {PROVINCIAS_AR.map(p => <option key={p.provincia} value={p.provincia}>{p.provincia}</option>)}
        </select>
        <select aria-label="Localidad" className={input} value={loc} onChange={e => setLoc(e.target.value)} disabled={!prov}>
          <option value="">Localidad…</option>
          {localidades.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={add} disabled={busy || !loc} className="px-3 py-2 rounded-lg bg-gray-800 dark:bg-gray-600 text-white text-sm disabled:opacity-50">
          Agregar localidad
        </button>
      </div>
    </li>
  );
}

export default function DemandaAutoCard() {
  const { user, loading: authLoading, getIdToken, login } = useAuthUser();
  const [config, setConfig] = useState(null);
  const [runs, setRuns] = useState([]);
  const [nuevaZona, setNuevaZona] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const authFetch = useCallback(async (url, options = {}) => {
    const token = await getIdToken();
    return fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }, [getIdToken]);

  const load = useCallback(async () => {
    setErrorMsg('');
    try {
      const res = await authFetch('/api/demanda-auto/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar');
      setConfig(data.config);
      setRuns(data.runs || []);
    } catch (e) {
      setErrorMsg(e.message);
    }
  }, [authFetch]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const patch = async (body, okMsg) => {
    setBusy(true); setMsg(''); setErrorMsg('');
    try {
      const res = await authFetch('/api/demanda-auto/', { method: 'PATCH', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar');
      setMsg(okMsg);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const run = async (zonaId, publicar) => {
    if (publicar && !window.confirm('Esto arma el informe y lo PUBLICA de verdad (PDF en LinkedIn, carrusel en Facebook + Instagram). ¿Correr ahora?')) return;
    setBusy(true); setMsg(publicar ? 'Corriendo… (puede tardar un par de minutos)' : 'Armando el informe sin publicar…'); setErrorMsg('');
    try {
      const res = await authFetch('/api/cron/demanda/', { method: 'POST', body: JSON.stringify({ zonaId, publicar }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falló la corrida');
      setMsg(`Corrida: ${data.estado || data.skipped}${data.zona ? ` · ${data.zona}` : ''}${data.error ? ` — ${data.error}` : ''}`);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveZonas = (zonas, okMsg) => patch({ zonas: zonas.map(({ nombre, localidades }) => ({ nombre, localidades })) }, okMsg);

  if (authLoading) return <p className="text-sm text-gray-500">Cargando…</p>;
  if (!user) {
    return <button onClick={login} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Iniciar sesión como admin</button>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Informes de demanda</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl">
              Arma el ranking de los 20 rubros más buscados de una zona, lo publica en <a href="/demanda/" target="_blank" rel="noreferrer" className="underline">/demanda</a> y
              lo anuncia: PDF en LinkedIn y carrusel en Facebook + Instagram. Corre martes a viernes a las 18:00 (cron de Vercel), una zona por vez; cada zona sale como mucho una vez por semana.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => patch({ activo: !config?.activo }, config?.activo ? 'Automatización apagada' : 'Automatización encendida')}
              disabled={busy || !config}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${config?.activo ? 'bg-green-600' : 'bg-gray-500'}`}>
              {config?.activo ? 'Encendida' : 'Apagada'}
            </button>
            <button onClick={() => run(null, true)} disabled={busy || !config}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white disabled:opacity-50">
              Correr ahora
            </button>
          </div>
        </div>
        {msg && <p className="mt-3 text-sm text-green-700 dark:text-green-400" role="status">{msg}</p>}
        {errorMsg && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{errorMsg}</p>}
      </div>

      {config && (
        <>
          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Zonas ({config.zonas.length})</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Una zona puede ser una ciudad o un grupo de localidades que salen juntas en un informe. Sale primero la que hace más tiempo que no sale.
              Con menos de 4 zonas no alcanzan para los 4 posts de la semana.
            </p>
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {config.zonas.map((z, i) => (
                <ZonaEditor key={z.id} zona={z} busy={busy} onRun={run}
                  onChange={nz => saveZonas(config.zonas.map((x, j) => (j === i ? nz : x)), 'Zona guardada')}
                  onDelete={() => window.confirm(`¿Eliminar la zona ${z.nombre}?`) && saveZonas(config.zonas.filter((_, j) => j !== i), 'Zona eliminada')} />
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <input className={`${input} flex-1 min-w-48`} placeholder="Nombre de la zona nueva (ej. Comarca Andina)" aria-label="Nombre de la zona nueva"
                value={nuevaZona} onChange={e => setNuevaZona(e.target.value)} />
              <button disabled={busy || !nuevaZona.trim()}
                onClick={() => { saveZonas([...config.zonas, { nombre: nuevaZona.trim(), localidades: [{ provincia: 'Neuquén', localidad: 'Neuquén' }] }], 'Zona creada: cambiale las localidades'); setNuevaZona(''); }}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">
                Crear zona
              </button>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Últimas corridas</h3>
            {runs.length === 0 && <p className="text-sm text-gray-500">Todavía no hay corridas.</p>}
            <ul className="space-y-2">
              {runs.map(r => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_STYLE[r.estado] || ESTADO_STYLE.error}`}>{r.estado}</span>
                  <span>{r.zona}</span>
                  {r.rubrosConDatos != null && <span className="text-gray-500">{r.rubrosConDatos} rubros con datos</span>}
                  {r.createdAt && <span className="text-gray-400 text-xs">{new Date(r.createdAt).toLocaleString('es-AR')}</span>}
                  {r.reporteId && <a className="text-indigo-600 underline text-xs" href={`/demanda/${r.reporteId}/`} target="_blank" rel="noreferrer">ver informe</a>}
                  {r.error && <span className="basis-full text-xs text-red-600 dark:text-red-400">{r.error}</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
