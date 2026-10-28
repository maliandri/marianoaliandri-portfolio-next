'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

// Bot de contenido (reemplaza al de noticias): series que rotan, carrusel en Facebook + Instagram,
// PDF en LinkedIn y página en /aprende. Lógica en src/lib/contenidoRun.js.
const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';
const input = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100';
const ESTADO = {
  publicado: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  borrador: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
};

function Serie({ s, onSave, busy }) {
  const [abierta, setAbierta] = useState(false);
  const [angulo, setAngulo] = useState(s.angulo);
  const [ctaPath, setCtaPath] = useState(s.cta?.path || '');
  const [ctaLabel, setCtaLabel] = useState(s.cta?.label || '');
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
          <input type="checkbox" checked={s.activo !== false} disabled={busy} onChange={() => onSave({ ...s, activo: s.activo === false })} />
          <span className="font-medium">{s.nombre}</span>
          <span className="text-xs text-gray-500">→ {s.cta?.path}</span>
        </label>
        <button className="text-xs underline text-gray-600 dark:text-gray-300" onClick={() => setAbierta(!abierta)} aria-expanded={abierta}>
          {abierta ? 'Cerrar' : 'Editar'}
        </button>
      </div>
      {abierta && (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-gray-500" htmlFor={`ang-${s.id}`}>Qué tiene que hacer la pieza (instrucción para la IA)</label>
          <textarea id={`ang-${s.id}`} rows={4} className={input} value={angulo} onChange={e => setAngulo(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={input} aria-label="Texto del botón" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} />
            <input className={input} aria-label="Página del sitio a la que lleva" value={ctaPath} onChange={e => setCtaPath(e.target.value)} />
          </div>
          <button disabled={busy} onClick={() => onSave({ ...s, angulo, cta: { label: ctaLabel, path: ctaPath } })}
            className="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-600 text-white text-xs disabled:opacity-50">Guardar serie</button>
        </div>
      )}
    </li>
  );
}

export default function ContenidoBotCard() {
  const { user, loading: authLoading, getIdToken, login } = useAuthUser();
  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [serieId, setSerieId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const authFetch = useCallback(async (url, options = {}) => {
    const token = await getIdToken();
    return fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  }, [getIdToken]);

  const load = useCallback(async () => {
    setErrorMsg('');
    try {
      const res = await authFetch('/api/contenido/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar');
      setConfig(data.config);
      setItems(data.items || []);
    } catch (e) {
      setErrorMsg(e.message);
    }
  }, [authFetch]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const call = async (url, method, body, okMsg) => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch(url, { method, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falló');
      setMsg(typeof okMsg === 'function' ? okMsg(data) : okMsg);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const generar = (publicar) => {
    if (publicar && !window.confirm('Genera una pieza y la PUBLICA de verdad (Facebook, Instagram y LinkedIn). ¿Seguro?')) return;
    setMsg(publicar ? 'Generando y publicando… (1 a 2 minutos)' : 'Generando la vista previa… (1 a 2 minutos)');
    call('/api/cron/contenido/', 'POST', { serieId: serieId || undefined, publicar }, d =>
      d.estado === 'error' ? `No salió: ${d.error}` : `${d.estado === 'publicado' ? 'Publicada' : 'Vista previa lista'}: ${d.titulo}${d.error ? ` (ojo: ${d.error})` : ''}`);
  };

  const publicar = (id) => {
    if (!window.confirm('¿Publicar esta pieza en Facebook, Instagram y LinkedIn?')) return;
    setMsg('Publicando…');
    call('/api/cron/contenido/', 'POST', { id }, d => (d.error ? `Publicada con problemas: ${d.error}` : 'Publicada'));
  };

  const guardarSerie = (s) => call('/api/contenido/', 'PATCH', { series: config.series.map(x => (x.id === s.id ? s : x)) }, 'Serie guardada');

  if (authLoading) return <p className="text-sm text-gray-500">Cargando…</p>;
  if (!user) return <button onClick={login} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Iniciar sesión como admin</button>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Bot de contenido</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl">
              Lunes a viernes a las 12:00 publica una pieza de la serie que toca: carrusel en Facebook + Instagram, PDF en
              LinkedIn y su página en <a href="/aprende/" target="_blank" rel="noreferrer" className="underline">/aprende</a>.
            </p>
          </div>
          <button onClick={() => call('/api/contenido/', 'PATCH', { activo: !config?.activo }, config?.activo ? 'Bot apagado' : 'Bot encendido')}
            disabled={busy || !config}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${config?.activo ? 'bg-green-600' : 'bg-gray-500'}`}>
            {config?.activo ? 'Encendido' : 'Apagado'}
          </button>
        </div>
        {config && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="cb-serie">Serie</label>
            <select id="cb-serie" className={`${input} w-auto`} value={serieId} onChange={e => setSerieId(e.target.value)}>
              <option value="">La serie que toca</option>
              {config.series.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <button onClick={() => generar(false)} disabled={busy} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">Vista previa</button>
            <button onClick={() => generar(true)} disabled={busy} className="px-3 py-2 rounded-lg border border-indigo-600 text-indigo-700 dark:text-indigo-300 text-sm disabled:opacity-50">Generar y publicar</button>
          </div>
        )}
        {msg && <p className="mt-3 text-sm text-green-700 dark:text-green-400" role="status">{msg}</p>}
        {errorMsg && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{errorMsg}</p>}
      </div>

      {items.length > 0 && (
        <div className={card}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Últimas piezas</h3>
          <ul className="space-y-5">
            {items.map(it => (
              <li key={it.id} className="text-sm text-gray-800 dark:text-gray-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO[it.estado] || ESTADO.borrador}`}>{it.estado}</span>
                  <span className="font-medium">{it.titulo}</span>
                  <span className="text-xs text-gray-500">{it.serie} · {new Date(it.createdAtMs).toLocaleString('es-AR')} · {it.proveedor}</span>
                  {it.estado === 'publicado'
                    ? <a className="text-indigo-600 underline text-xs" href={`/aprende/${it.id}/`} target="_blank" rel="noreferrer">ver página</a>
                    : <button disabled={busy} onClick={() => publicar(it.id)} className="text-xs px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50">Publicar</button>}
                </div>
                {it.error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{it.error}</p>}
                <div className="flex gap-2 overflow-x-auto py-2">
                  {it.imagenes.map((u, i) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer" className="shrink-0">
                      <img src={u.replace('/upload/', '/upload/w_200/')} alt={`Placa ${i + 1}`} width={96} height={120} className="w-24 h-30 object-cover rounded border border-gray-200 dark:border-gray-700" />
                    </a>
                  ))}
                </div>
                <details>
                  <summary className="text-xs text-gray-500 cursor-pointer">Texto del post</summary>
                  <p className="whitespace-pre-line text-xs text-gray-600 dark:text-gray-300 mt-1">{it.caption}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}

      {config && (
        <div className={card}>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Series ({config.series.filter(s => s.activo !== false).length} activas)</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Rotan en orden: sale la que hace más tiempo que no sale.</p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {config.series.map(s => <Serie key={s.id} s={s} busy={busy} onSave={guardarSerie} />)}
          </ul>
        </div>
      )}
    </div>
  );
}
