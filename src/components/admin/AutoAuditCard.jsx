'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

const ESTADO_STYLE = {
  ok: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  sin_resultados: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  cuota_agotada: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  post_fallido: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const NETWORK_LABELS = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook' };

export default function AutoAuditCard() {
  const { user, loading: authLoading, getIdToken, login } = useAuthUser();
  const [config, setConfig] = useState(null);
  const [runs, setRuns] = useState([]);
  const [ciudadesText, setCiudadesText] = useState('');
  const [rubros, setRubros] = useState([]);
  const [newRubro, setNewRubro] = useState({ label: '', kind: 'text', value: '', prioritario: true });
  const [imageUrl, setImageUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const authFetch = useCallback(async (url, options = {}) => {
    const token = await getIdToken();
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  }, [getIdToken]);

  const load = useCallback(async () => {
    setErrorMsg('');
    try {
      const res = await authFetch('/api/auditoria-auto/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar');
      setConfig(data.config);
      setRuns(data.runs || []);
      setCiudadesText((data.config.ciudades || []).join('\n'));
      setRubros(data.config.rubros || []);
      setImageUrl(data.config.imageUrl || '');
    } catch (e) {
      setErrorMsg(e.message);
    }
  }, [authFetch]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const patch = async (body, okMsg) => {
    setBusy(true); setMsg(''); setErrorMsg('');
    try {
      const res = await authFetch('/api/auditoria-auto/', { method: 'PATCH', body: JSON.stringify(body) });
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

  const runNow = async () => {
    if (!window.confirm('Esto audita y PUBLICA en redes de verdad. ¿Correr ahora?')) return;
    setRunning(true); setMsg(''); setErrorMsg('');
    try {
      const res = await authFetch('/api/cron/auditoria/', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falló la corrida');
      setMsg(`Corrida: ${data.estado || data.skipped} (${data.auditados ?? 0} sitios)`);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setRunning(false);
    }
  };

  const toggleNetwork = (n) => {
    const current = config.networks || [];
    const next = current.includes(n) ? current.filter(x => x !== n) : [...current, n];
    if (!next.length) return;
    patch({ networks: next }, 'Redes actualizadas');
  };

  const addRubro = () => {
    if (!newRubro.label.trim() || !newRubro.value.trim()) return;
    const next = [...rubros, { ...newRubro, label: newRubro.label.trim(), value: newRubro.value.trim() }];
    setNewRubro({ label: '', kind: 'text', value: '', prioritario: true });
    patch({ rubros: next }, 'Rubro agregado');
  };

  if (authLoading) return <p className="text-sm text-gray-500">Cargando…</p>;
  if (!user) {
    return (
      <button onClick={login} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">
        Iniciar sesión como admin
      </button>
    );
  }

  const input = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100';
  const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';

  return (
    <div className="space-y-6 max-w-4xl">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Auditoría automática</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Audita un rubro en una ciudad, publica el informe y lo anuncia en redes. Se dispara martes y viernes por GitHub Actions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => patch({ activo: !config?.activo }, config?.activo ? 'Automatización apagada' : 'Automatización encendida')}
              disabled={busy || !config}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${config?.activo ? 'bg-green-600' : 'bg-gray-500'}`}
            >
              {config?.activo ? 'Encendida' : 'Apagada'}
            </button>
            <button onClick={runNow} disabled={running || !config}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white disabled:opacity-50">
              {running ? 'Corriendo…' : 'Correr ahora'}
            </button>
          </div>
        </div>
        {msg && <p className="mt-3 text-sm text-green-700 dark:text-green-400" role="status">{msg}</p>}
        {errorMsg && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{errorMsg}</p>}
      </div>

      {config && (
        <>
          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Redes e imagen</h3>
            <div className="flex flex-wrap gap-4 mb-4">
              {Object.entries(NETWORK_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={(config.networks || []).includes(key)} onChange={() => toggleNetwork(key)} disabled={busy} />
                  {label}
                </label>
              ))}
            </div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1" htmlFor="aa-image">Imagen del post (https, 1080×1080)</label>
            <div className="flex gap-2">
              <input id="aa-image" className={input} value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
              <button onClick={() => patch({ imageUrl }, 'Imagen guardada')} disabled={busy}
                className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm dark:bg-gray-600 disabled:opacity-50">Guardar</button>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Ciudades ({(config.ciudades || []).length})</h3>
            <label className="sr-only" htmlFor="aa-ciudades">Ciudades, una por línea</label>
            <textarea id="aa-ciudades" rows={8} className={input} value={ciudadesText} onChange={e => setCiudadesText(e.target.value)} />
            <button
              onClick={() => patch({ ciudades: ciudadesText.split('\n') }, 'Ciudades guardadas')}
              disabled={busy}
              className="mt-2 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm dark:bg-gray-600 disabled:opacity-50">
              Guardar ciudades
            </button>
          </div>

          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Rubros ({rubros.length})</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Prioritarios (⭐): negocios con etapas constructivas o de fabricación. Salen ~80% de las corridas.
            </p>
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 mb-4">
              {rubros.map((r, i) => (
                <li key={`${r.label}-${i}`} className="flex items-center justify-between py-1.5 text-sm text-gray-800 dark:text-gray-200">
                  <span>{r.prioritario ? '⭐ ' : ''}{r.label} <span className="text-xs text-gray-400">({r.kind === 'type' ? 'tipo Places' : 'texto'})</span></span>
                  <span className="flex gap-2">
                    <button disabled={busy} className="text-xs underline"
                      onClick={() => patch({ rubros: rubros.map((x, j) => j === i ? { ...x, prioritario: !x.prioritario } : x) }, 'Rubro actualizado')}>
                      {r.prioritario ? 'Quitar ⭐' : 'Dar ⭐'}
                    </button>
                    <button disabled={busy || rubros.length <= 1} className="text-xs text-red-600 underline"
                      onClick={() => patch({ rubros: rubros.filter((_, j) => j !== i) }, 'Rubro eliminado')}>
                      Eliminar
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input className={input} placeholder="Nombre (ej. Steel framing)" aria-label="Nombre del rubro"
                value={newRubro.label} onChange={e => setNewRubro({ ...newRubro, label: e.target.value })} />
              <input className={input} placeholder="Búsqueda o tipo (ej. steel framing)" aria-label="Término de búsqueda o tipo de Places"
                value={newRubro.value} onChange={e => setNewRubro({ ...newRubro, value: e.target.value })} />
              <select className={input} aria-label="Tipo de búsqueda" value={newRubro.kind}
                onChange={e => setNewRubro({ ...newRubro, kind: e.target.value })}>
                <option value="text">texto</option>
                <option value="type">tipo Places</option>
              </select>
              <button onClick={addRubro} disabled={busy}
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">Agregar</button>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Últimas corridas</h3>
            {runs.length === 0 && <p className="text-sm text-gray-500">Todavía no hay corridas.</p>}
            <ul className="space-y-2">
              {runs.map(r => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_STYLE[r.estado] || ESTADO_STYLE.error}`}>{r.estado}</span>
                  <span>{r.combo ? `${r.combo.rubro} · ${r.combo.ciudad}` : '—'}</span>
                  <span className="text-gray-500">{r.auditados ?? 0} sitios</span>
                  {r.createdAt && <span className="text-gray-400 text-xs">{new Date(r.createdAt).toLocaleString('es-AR')}</span>}
                  {r.auditoriaId && <a className="text-indigo-600 underline text-xs" href={`/auditorias/${r.auditoriaId}`} target="_blank" rel="noreferrer">ver informe</a>}
                  {r.error && <span className="text-xs text-red-600 dark:text-red-400">{r.error}</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
