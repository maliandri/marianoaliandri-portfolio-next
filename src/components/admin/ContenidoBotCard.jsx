'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import GuionesPanel from './GuionesPanel';
import ReelsBotCard from './ReelsBotCard';

// Bot de contenido (reemplaza al de noticias): series que rotan, carrusel en Facebook + Instagram,
// PDF en LinkedIn, página en /aprende, reels automáticos y guiones para grabar con cara.
// Submenú (adminNav.js → contenido-bot): generar · piezas · guiones · reels · series.
// Lógica en src/lib/contenidoRun.js, src/lib/guionesRun.js y src/lib/reels.js.
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

// Cómo sale todo solo, en el orden real en que pasa.
function ComoSale({ activo, reels }) {
  const pasos = [
    ['Lun a vie · 12:00', 'Pieza del día', 'Toma la primera idea de la cola o, si no hay, la serie que toca. La IA la escribe, se arman las placas y sale en Facebook + Instagram (carrusel), LinkedIn (PDF) y /aprende.', activo],
    ['Lun, mié y vie · 10:00', 'Reel automático', 'Toma una pieza sin reel (primero las que marcaste "con reel"), le pone voz y la anima. Si "Armar también el reel" puede pedirlo a GitHub, sale en unos 5 minutos.', true],
    ['Cuando termina el reel', 'Publicación del reel', reels ? 'Se publica solo en Instagram, Facebook y LinkedIn.' : 'Queda como borrador en Reels para que lo mires y lo publiques (la publicación automática del reel está apagada).', reels],
  ];
  return (
    <ol className="grid gap-3 md:grid-cols-3">
      {pasos.map(([cuando, que, detalle, on], i) => (
        <li key={que} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs font-semibold text-gray-500">{i + 1}. {cuando}</p>
          <p className="mt-1 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {que}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${on ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>{on ? 'ACTIVO' : 'APAGADO'}</span>
          </p>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{detalle}</p>
        </li>
      ))}
    </ol>
  );
}

export default function ContenidoBotCard({ sub = 'generar' }) {
  const { user, loading: authLoading, getIdToken, login } = useAuthUser();
  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [reelsActivo, setReelsActivo] = useState(false);
  const [idea, setIdea] = useState({ tema: '', serieId: '', conReel: true });
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
      const [res, rr] = await Promise.all([authFetch('/api/contenido/'), authFetch('/api/reels/').catch(() => null)]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar');
      setConfig(data.config);
      setItems(data.items || []);
      const reels = rr?.ok ? await rr.json().catch(() => null) : null;
      setReelsActivo(reels?.activo === true);
    } catch (e) {
      setErrorMsg(e.message);
    }
  }, [authFetch]);

  useEffect(() => { if (user && sub !== 'guiones' && sub !== 'reels') load(); }, [user, sub, load]);
  useEffect(() => { setMsg(''); setErrorMsg(''); }, [sub]);

  const call = async (url, method, body, okMsg) => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch(url, { method, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falló');
      setMsg(typeof okMsg === 'function' ? okMsg(data) : okMsg);
      await load();
      return data;
    } catch (e) {
      setErrorMsg(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const generar = async (publicar) => {
    if (publicar && !window.confirm('Genera la pieza y la PUBLICA de verdad (Facebook, Instagram y LinkedIn). ¿Seguro?')) return;
    setMsg(publicar ? 'Generando y publicando… (1 a 3 minutos)' : 'Generando la vista previa… (1 a 2 minutos)');
    const d = await call('/api/cron/contenido/', 'POST', { serieId: idea.serieId || undefined, tema: idea.tema.trim(), conReel: idea.conReel, publicar }, d =>
      d.estado === 'error'
        ? `No salió: ${d.error}`
        : `${d.estado === 'publicado' ? 'Publicada' : 'Vista previa lista en Últimas piezas'}: ${d.titulo}.${d.reel ? ` ${d.reel}.` : ''}${d.error ? ` Ojo: ${d.error}` : ''}`);
    if (d && d.estado !== 'error') setIdea(i => ({ ...i, tema: '' }));
  };

  const guardarCola = (cola, okMsg) => call('/api/contenido/', 'PATCH', { cola }, okMsg);
  const encolar = async () => {
    if (idea.tema.trim().length < 5) { setErrorMsg('Escribí la idea de la pieza para dejarla en la cola.'); return; }
    const d = await guardarCola([...(config.cola || []), { tema: idea.tema.trim(), serieId: idea.serieId || null, conReel: idea.conReel }], 'Quedó en la cola: sale en una de las próximas corridas automáticas.');
    if (d) setIdea(i => ({ ...i, tema: '' }));
  };
  const moverCola = (i, dir) => {
    const c = [...config.cola];
    [c[i], c[i + dir]] = [c[i + dir], c[i]];
    guardarCola(c, 'Cola reordenada');
  };

  const publicar = (id) => {
    if (!window.confirm('¿Publicar esta pieza en Facebook, Instagram y LinkedIn?')) return;
    setMsg('Publicando…');
    call('/api/cron/contenido/', 'POST', { id }, d => (d.error ? `Publicada con problemas: ${d.error}` : 'Publicada'));
  };
  const pedirReel = (id) => call('/api/cron/contenido/', 'POST', { pedirReel: id }, d => `${d.reel}.`);
  const guardarSerie = (s) => call('/api/contenido/', 'PATCH', { series: config.series.map(x => (x.id === s.id ? s : x)) }, 'Serie guardada');

  if (authLoading) return <p className="text-sm text-gray-500">Cargando…</p>;
  if (!user) return <button onClick={login} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm">Iniciar sesión como admin</button>;
  if (sub === 'guiones') return <GuionesPanel authFetch={authFetch} />;
  if (sub === 'reels') return <ReelsBotCard />;

  const avisos = (
    <>
      {msg && <p className="text-sm text-green-700 dark:text-green-400" role="status">{msg}</p>}
      {errorMsg && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{errorMsg}</p>}
    </>
  );
  if (!config) return errorMsg ? avisos : <p className="text-sm text-gray-500">Cargando…</p>;

  if (sub === 'series') {
    return (
      <div className={`${card} max-w-4xl`}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Series ({config.series.filter(s => s.activo !== false).length} activas)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Rotan en orden: sale la que hace más tiempo que no sale. Las ideas de la cola pasan primero.</p>
        {avisos}
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {config.series.map(s => <Serie key={s.id} s={s} busy={busy} onSave={guardarSerie} />)}
        </ul>
      </div>
    );
  }

  if (sub === 'piezas') {
    return (
      <div className="space-y-4 max-w-5xl">
        {avisos}
        {!items.length && <p className={`${card} text-sm text-gray-500 text-center`}>Todavía no hay piezas. Generá la primera en "Generar y publicar".</p>}
        <ul className="grid gap-4 lg:grid-cols-2">
          {items.map(it => (
            <li key={it.id} className={`${card} text-sm text-gray-800 dark:text-gray-200`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO[it.estado] || ESTADO.borrador}`}>{it.estado}</span>
                <span className="text-xs text-gray-500">{it.serie} · {new Date(it.createdAtMs).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })} · {it.proveedor}</span>
              </div>
              <p className="mt-1 font-semibold text-gray-900 dark:text-white">{it.titulo}</p>
              {it.tema && <p className="text-xs text-gray-500">Idea: {it.tema}</p>}
              {it.error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{it.error}</p>}
              <div className="flex gap-2 overflow-x-auto py-2">
                {it.imagenes.map((u, i) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="shrink-0">
                    <img src={u.replace('/upload/', '/upload/w_200/')} alt={`Placa ${i + 1}`} width={80} height={100} className="w-20 h-25 object-cover rounded border border-gray-200 dark:border-gray-700" />
                  </a>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {it.estado === 'publicado'
                  ? <a className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600" href={`/aprende/${it.id}/`} target="_blank" rel="noreferrer">Ver página</a>
                  : <button disabled={busy} onClick={() => publicar(it.id)} className="text-xs px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50">Publicar</button>}
                {it.reelId
                  ? <span className="text-xs text-gray-500">🎞️ Reel armado (ver en Reels)</span>
                  : it.reelPedido
                    ? <span className="text-xs text-amber-700 dark:text-amber-400">🎞️ Reel pedido</span>
                    : <button disabled={busy} onClick={() => pedirReel(it.id)} className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50">Armar reel</button>}
              </div>
              <details className="mt-2">
                <summary className="text-xs text-gray-500 cursor-pointer">Texto del post</summary>
                <p className="whitespace-pre-line text-xs text-gray-600 dark:text-gray-300 mt-1">{it.caption}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // sub === 'generar'
  const cola = config.cola || [];
  return (
    <div className="space-y-6 max-w-5xl">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Próxima pieza</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xl">Contale la idea y la arma: placas, texto del post y su página en /aprende. Sin idea, sale la serie que toca.</p>
          </div>
          <button onClick={() => call('/api/contenido/', 'PATCH', { activo: !config.activo }, config.activo ? 'Bot apagado: no sale nada solo' : 'Bot encendido: sale una pieza de lunes a viernes a las 12')}
            disabled={busy} aria-pressed={config.activo}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${config.activo ? 'bg-green-600' : 'bg-gray-500'}`}>
            {config.activo ? 'Publicación automática: encendida' : 'Publicación automática: apagada'}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Idea de la pieza</span>
            <textarea rows={3} maxLength={500} className={`${input} mt-1`} value={idea.tema}
              placeholder="Ej.: qué le preguntaría a Claude una constructora que tiene 5 obras abiertas"
              onChange={e => setIdea(i => ({ ...i, tema: e.target.value }))} />
          </label>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-500">Serie</span>
              <select className={`${input} mt-1`} value={idea.serieId} onChange={e => setIdea(i => ({ ...i, serieId: e.target.value }))}>
                <option value="">La que toca</option>
                {config.series.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={idea.conReel} onChange={e => setIdea(i => ({ ...i, conReel: e.target.checked }))} /> Armar también el reel
            </label>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={() => generar(false)} disabled={busy} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">Generar vista previa</button>
          <button onClick={() => generar(true)} disabled={busy} className="px-4 py-2 rounded-lg border border-indigo-600 text-indigo-700 dark:text-indigo-300 text-sm disabled:opacity-50">Generar y publicar</button>
          <button onClick={encolar} disabled={busy} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm disabled:opacity-50">Dejar en la cola</button>
        </div>
        <div className="mt-3">{avisos}</div>
      </div>

      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white">Cola ({cola.length})</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Cada corrida automática toma la primera. Sin ideas en la cola, rota las series.</p>
        {!cola.length && <p className="text-sm text-gray-500">Vacía. Escribí una idea arriba y tocá "Dejar en la cola".</p>}
        <ol className="divide-y divide-gray-100 dark:divide-gray-700">
          {cola.map((c, i) => (
            <li key={c.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="w-5 text-xs font-bold text-gray-400">{i + 1}</span>
              <span className="flex-1 min-w-[12rem] text-gray-800 dark:text-gray-200">{c.tema}</span>
              <span className="text-xs text-gray-500">{config.series.find(s => s.id === c.serieId)?.nombre || 'serie que toca'}{c.conReel ? ' · con reel' : ''}</span>
              <button aria-label="Subir" disabled={busy || i === 0} onClick={() => moverCola(i, -1)} className="px-2 text-gray-500 disabled:opacity-30">↑</button>
              <button aria-label="Bajar" disabled={busy || i === cola.length - 1} onClick={() => moverCola(i, 1)} className="px-2 text-gray-500 disabled:opacity-30">↓</button>
              <button disabled={busy} onClick={() => guardarCola(cola.filter(x => x.id !== c.id), 'Idea sacada de la cola')} className="text-xs text-red-600 dark:text-red-400 disabled:opacity-50">Quitar</button>
            </li>
          ))}
        </ol>
      </div>

      <div className={card}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Cómo sale todo solo</h3>
        <ComoSale activo={config.activo} reels={reelsActivo} />
      </div>
    </div>
  );
}
