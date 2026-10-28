'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

// Reels automáticos: los arma GitHub Actions (Remotion) lun/mié/vie 10:00. Acá se miran y se publican.
const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5';
const TIPO = { explicador: 'Explicador', ranking: 'Ranking de demanda', dato: 'Dato de auditorías' };
const ACTIONS_URL = 'https://github.com/maliandri/marianoaliandri-portfolio-next/actions/workflows/reel-bot.yml';

export default function ReelsBotCard() {
  const { user, loading: authLoading, getIdToken, login } = useAuthUser();
  const [data, setData] = useState(null);
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
      const res = await authFetch('/api/reels/');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'No se pudo cargar');
      setData(d);
    } catch (e) {
      setErrorMsg(e.message);
    }
  }, [authFetch]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const call = async (method, body, okMsg) => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch('/api/reels/', { method, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Falló');
      setMsg(typeof okMsg === 'function' ? okMsg(d) : okMsg);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const publicar = (id) => {
    if (!window.confirm('¿Publicar este reel en Instagram y en la página de Facebook?')) return;
    setMsg('Publicando… (Instagram tarda 1 o 2 minutos en procesar el video)');
    call('POST', { id }, d => (d.error ? `Publicado con problemas: ${d.error}` : 'Publicado en Instagram y Facebook'));
  };

  if (authLoading) return <p className="text-sm text-gray-500">Cargando…</p>;
  if (!user) return <button onClick={login} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Iniciar sesión como admin</button>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reels automáticos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl">
              Lunes, miércoles y viernes a las 10:00 se arma un reel (rotan: explicador del bot de contenido, ranking de
              demanda y dato de auditorías) con voz en off. Apagado = queda acá para revisarlo; prendido = se publica solo
              en Instagram y Facebook. Para armar uno ahora: <a href={ACTIONS_URL} target="_blank" rel="noreferrer" className="underline">GitHub → Run workflow</a>.
            </p>
          </div>
          <button onClick={() => call('PATCH', { activo: !data?.activo }, data?.activo ? 'Publicación automática apagada' : 'Publicación automática encendida')}
            disabled={busy || !data}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${data?.activo ? 'bg-green-600' : 'bg-gray-500'}`}>
            {data?.activo ? 'Publica solo' : 'Solo borradores'}
          </button>
        </div>
        {msg && <p className="mt-3 text-sm text-green-700 dark:text-green-400" role="status">{msg}</p>}
        {errorMsg && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{errorMsg}</p>}
      </div>

      {data?.items?.length === 0 && <p className="text-sm text-gray-500">Todavía no hay reels.</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        {data?.items?.map(r => (
          <div key={r.id} className={card}>
            <video src={r.videoUrl} controls preload="metadata" playsInline className="w-full aspect-[9/16] rounded-lg bg-black" />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.estado === 'publicado' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'}`}>{r.estado}</span>
              <span className="text-xs text-gray-500">{TIPO[r.tipo] || r.tipo} · {Math.round(r.duracion || 0)} s · {new Date(r.createdAtMs).toLocaleString('es-AR')}</span>
            </div>
            <p className="mt-1 font-medium text-gray-900 dark:text-white text-sm">{r.titulo}</p>
            {r.error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{r.error}</p>}
            <details className="mt-1">
              <summary className="text-xs text-gray-500 cursor-pointer">Texto del post</summary>
              <p className="whitespace-pre-line text-xs text-gray-600 dark:text-gray-300 mt-1">{r.caption}</p>
            </details>
            {r.estado !== 'publicado' && (
              <button disabled={busy} onClick={() => publicar(r.id)} className="mt-3 px-3 py-2 rounded-lg bg-green-600 text-white text-sm disabled:opacity-50">Publicar</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
