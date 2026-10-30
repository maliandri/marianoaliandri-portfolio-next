'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// Guiones de reels para grabar con cara (src/lib/guionesRun.js). Cada guion se lee como una hoja de
// rodaje: el gancho arriba, las tomas en orden con lo que se dice y lo que se ve, y abajo música/edición.
const card = 'rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
const input = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100';
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ESTADOS = {
  pendiente: { label: 'Para grabar', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  grabado: { label: 'Grabado', cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  publicado: { label: 'Publicado', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  descartado: { label: 'Descartado', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
};
const fecha = (ms) => new Date(ms).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

function Campo({ label, value, onChange, rows = 1, max }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {rows > 1
        ? <textarea rows={rows} maxLength={max} className={`${input} mt-1`} value={value} onChange={e => onChange(e.target.value)} />
        : <input maxLength={max} className={`${input} mt-1`} value={value} onChange={e => onChange(e.target.value)} />}
    </label>
  );
}

function Guion({ g, formatos, busy, onPatch, onRegenerar }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState(g);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { setF(g); }, [g]);
  const set = (k) => (v) => setF(x => ({ ...x, [k]: v }));
  const setToma = (i, k) => (v) => setF(x => ({ ...x, tomas: x.tomas.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));

  const guardar = async () => {
    const { titulo, gancho, textoEnPantalla, tomas, cierre, caption, musica, edicion } = f;
    if (await onPatch(g.id, { titulo, gancho, textoEnPantalla, tomas: tomas.filter(t => t.decir || t.mostrar), cierre, caption, musica, edicion })) setEditando(false);
  };
  const copiar = async () => {
    await navigator.clipboard.writeText(g.caption);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  const est = ESTADOS[g.estado] || ESTADOS.pendiente;

  return (
    <article className={`${card} overflow-hidden ${g.estado === 'descartado' ? 'opacity-60' : ''}`}>
      <header className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-full font-semibold ${est.cls}`}>{est.label}</span>
          <span className="uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400">{formatos[g.formato]?.split(':')[0] || g.formato}</span>
          <span className="text-gray-400">· {g.duracion}{g.proveedor ? ` · ${g.proveedor}` : ''}</span>
        </div>
        {editando
          ? <div className="mt-2"><Campo label="Título" value={f.titulo} onChange={set('titulo')} max={100} /></div>
          : <h4 className="mt-1 text-base font-bold text-gray-900 dark:text-white">{g.titulo}</h4>}
        {g.tema && <p className="mt-0.5 text-xs text-gray-500">Tema: {g.tema}</p>}
      </header>

      <div className="px-5 py-4 space-y-4">
        {editando ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Gancho (primeros 2 segundos)" value={f.gancho} onChange={set('gancho')} rows={2} max={300} />
            <Campo label="Texto en pantalla" value={f.textoEnPantalla} onChange={set('textoEnPantalla')} rows={2} max={80} />
          </div>
        ) : (
          <div className="rounded-xl bg-gray-900 dark:bg-black px-4 py-3">
            {g.textoEnPantalla && <p className="text-lg sm:text-xl font-black leading-tight text-white">{g.textoEnPantalla}</p>}
            <p className="mt-1 text-sm text-gray-300"><span className="text-amber-300 font-semibold">Gancho:</span> {g.gancho}</p>
          </div>
        )}

        <ol className="space-y-2">
          {(editando ? f.tomas : g.tomas).map((t, i) => (
            <li key={i} className="grid grid-cols-[1.75rem_1fr] gap-2">
              <span className="mt-1 h-6 w-6 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center justify-center">{i + 1}</span>
              {editando ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Campo label="Decí" value={t.decir} onChange={setToma(i, 'decir')} rows={2} max={400} />
                  <Campo label="Mostrá" value={t.mostrar} onChange={setToma(i, 'mostrar')} rows={2} max={200} />
                </div>
              ) : (
                <div className="grid gap-1 sm:grid-cols-[3fr_2fr] sm:gap-4 text-sm">
                  <p className="text-gray-900 dark:text-gray-100">{t.decir}</p>
                  <p className="text-gray-500 dark:text-gray-400 sm:border-l sm:border-gray-200 sm:dark:border-gray-700 sm:pl-3">🎥 {t.mostrar}</p>
                </div>
              )}
            </li>
          ))}
        </ol>
        {editando && f.tomas.length < 8 && (
          <button type="button" onClick={() => setF(x => ({ ...x, tomas: [...x.tomas, { decir: '', mostrar: '' }] }))} className="text-xs underline text-gray-600 dark:text-gray-300">+ Agregar toma</button>
        )}

        {editando ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Cierre" value={f.cierre} onChange={set('cierre')} rows={2} max={300} />
            <Campo label="Música" value={f.musica} onChange={set('musica')} rows={2} max={200} />
            <Campo label="Edición" value={f.edicion} onChange={set('edicion')} rows={2} max={400} />
            <Campo label="Texto del post" value={f.caption} onChange={set('caption')} rows={4} max={1500} />
          </div>
        ) : (
          <dl className="grid gap-2 sm:grid-cols-3 text-sm">
            <div><dt className="text-xs font-semibold text-gray-500">Cierre</dt><dd className="text-gray-800 dark:text-gray-200">{g.cierre}</dd></div>
            {g.musica && <div><dt className="text-xs font-semibold text-gray-500">Música</dt><dd className="text-gray-800 dark:text-gray-200">{g.musica}</dd></div>}
            {g.edicion && <div><dt className="text-xs font-semibold text-gray-500">Edición</dt><dd className="text-gray-800 dark:text-gray-200">{g.edicion}</dd></div>}
          </dl>
        )}
        {!editando && g.caption && (
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-gray-500">Texto del post</summary>
            <p className="whitespace-pre-line mt-1 text-gray-700 dark:text-gray-300">{g.caption}</p>
          </details>
        )}
      </div>

      <footer className="px-5 py-3 bg-gray-50 dark:bg-gray-900/40 flex flex-wrap items-center gap-2">
        {editando ? (
          <>
            <button disabled={busy} onClick={guardar} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50">Guardar cambios</button>
            <button onClick={() => { setF(g); setEditando(false); }} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300">Cancelar</button>
          </>
        ) : (
          <>
            <label className="sr-only" htmlFor={`est-${g.id}`}>Estado</label>
            <select id={`est-${g.id}`} disabled={busy} value={g.estado} onChange={e => onPatch(g.id, { estado: e.target.value })}
              className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200">
              {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => setEditando(true)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200">Editar</button>
            <button disabled={busy} onClick={() => onRegenerar(g.id)} className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 disabled:opacity-50">Rehacer con la IA</button>
            {g.caption && <button onClick={copiar} className="px-3 py-1.5 rounded-lg text-xs text-gray-600 dark:text-gray-300">{copiado ? 'Texto copiado' : 'Copiar texto del post'}</button>}
          </>
        )}
      </footer>
    </article>
  );
}

export default function GuionesPanel({ authFetch }) {
  const [data, setData] = useState(null);
  const [filtro, setFiltro] = useState('pendiente');
  const [pedido, setPedido] = useState({ tema: '', formato: '', cantidad: 3, mail: false });
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/guiones/');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'No se pudieron cargar los guiones');
      setData(d);
      setCfg(c => c || d.config);
    } catch (e) {
      setErrorMsg(e.message);
    }
  }, [authFetch]);
  useEffect(() => { load(); }, [load]);

  const call = async (method, body) => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await authFetch('/api/guiones/', { method, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Falló');
      await load();
      return d;
    } catch (e) {
      setErrorMsg(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const generar = async () => {
    setMsg('Escribiendo los guiones… (1 a 2 minutos)');
    const d = await call('POST', { ...pedido, tema: pedido.tema.trim() });
    if (d) { setMsg(`Listos ${d.guiones.length} guiones nuevos (${d.proveedor})${d.enviado ? ', también te llegan por mail' : ''}.`); setFiltro('pendiente'); }
    else setMsg('');
  };
  const regenerar = async (id) => {
    setMsg('Rehaciendo el guion…');
    const d = await call('POST', { regenerar: id });
    setMsg(d ? `Guion rehecho: ${d.guion.titulo}` : '');
  };
  const patch = async (id, campos) => Boolean(await call('PATCH', { id, ...campos }));
  const guardarCfg = async () => {
    const d = await call('PATCH', { config: cfg });
    if (d) setMsg('Guardado: así salen solos los guiones.');
  };

  const grupos = useMemo(() => {
    const lista = (data?.guiones || []).filter(g => filtro === 'todos' || g.estado === filtro);
    const m = new Map();
    for (const g of lista) {
      const k = g.lote || String(g.createdAtMs);
      if (!m.has(k)) m.set(k, { createdAtMs: g.createdAtMs, tema: g.tema, origen: g.origen, items: [] });
      m.get(k).items.push(g);
    }
    return [...m.values()];
  }, [data, filtro]);
  const cuenta = (e) => (data?.guiones || []).filter(g => e === 'todos' || g.estado === e).length;

  if (!data && !errorMsg) return <p className="text-sm text-gray-500">Cargando guiones…</p>;

  return (
    <div className="space-y-6 max-w-5xl">
      <section className={`${card} p-5`} aria-labelledby="g-pedir">
        <h3 id="g-pedir" className="font-semibold text-gray-900 dark:text-white">Pedir guiones nuevos</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">La IA usa tus auditorías, lo que se busca en Google y las últimas piezas. Sin tema, elige ella.</p>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_6rem]">
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Tema (opcional)</span>
            <input className={`${input} mt-1`} placeholder="Ej.: por qué una planilla de Excel no alcanza para tu stock" value={pedido.tema}
              onChange={e => setPedido(p => ({ ...p, tema: e.target.value }))} maxLength={500} />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Formato</span>
            <select className={`${input} mt-1`} value={pedido.formato} onChange={e => setPedido(p => ({ ...p, formato: e.target.value }))}>
              <option value="">Mezclados</option>
              {Object.entries(data?.formatos || {}).map(([k, v]) => <option key={k} value={k}>{v.split(':')[0]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500">Cuántos</span>
            <input type="number" min={1} max={6} className={`${input} mt-1`} value={pedido.cantidad}
              onChange={e => setPedido(p => ({ ...p, cantidad: Math.max(1, Math.min(6, Number(e.target.value) || 1)) }))} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button disabled={busy} onClick={generar} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">Escribir guiones</button>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={pedido.mail} onChange={e => setPedido(p => ({ ...p, mail: e.target.checked }))} /> Mandármelos también por mail
          </label>
        </div>
        {msg && <p className="mt-3 text-sm text-green-700 dark:text-green-400" role="status">{msg}</p>}
        {errorMsg && <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">{errorMsg}</p>}
      </section>

      {cfg && (
        <section className={`${card} p-5`} aria-labelledby="g-auto">
          <h3 id="g-auto" className="font-semibold text-gray-900 dark:text-white">Cuándo llegan solos</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">A las 8 de la mañana de los días marcados.</p>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex gap-1" role="group" aria-label="Días">
              {DIAS.map((d, i) => {
                const on = cfg.dias.includes(i);
                return (
                  <button key={d} type="button" aria-pressed={on}
                    onClick={() => setCfg(c => ({ ...c, dias: on ? c.dias.filter(x => x !== i) : [...c.dias, i] }))}
                    className={`w-11 py-1.5 rounded-lg text-xs font-semibold border ${on ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>{d}</button>
                );
              })}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="number" min={1} max={6} className={`${input} w-16`} value={cfg.cantidad} onChange={e => setCfg(c => ({ ...c, cantidad: Math.max(1, Math.min(6, Number(e.target.value) || 1)) }))} />
              guiones cada vez
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={cfg.mail} onChange={e => setCfg(c => ({ ...c, mail: e.target.checked }))} /> por mail
            </label>
            <button disabled={busy} onClick={guardarCfg} className="px-3 py-1.5 rounded-lg bg-gray-800 dark:bg-gray-600 text-white text-xs disabled:opacity-50">Guardar</button>
          </div>
        </section>
      )}

      <section aria-labelledby="g-lista">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h3 id="g-lista" className="font-semibold text-gray-900 dark:text-white">Guiones</h3>
          <div className="flex flex-wrap gap-1" role="tablist">
            {['pendiente', 'grabado', 'publicado', 'descartado', 'todos'].map(e => (
              <button key={e} role="tab" aria-selected={filtro === e} onClick={() => setFiltro(e)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${filtro === e ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
                {e === 'todos' ? 'Todos' : ESTADOS[e].label} ({cuenta(e)})
              </button>
            ))}
          </div>
        </div>
        {!grupos.length && (
          <p className={`${card} p-6 text-sm text-gray-500 text-center`}>
            {filtro === 'pendiente' ? 'No queda nada para grabar. Pedí guiones nuevos arriba.' : 'No hay guiones en este estado.'}
          </p>
        )}
        <div className="space-y-8">
          {grupos.map(gr => (
            <div key={`${gr.createdAtMs}-${gr.items[0].id}`}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {fecha(gr.createdAtMs)}{gr.tema ? ` · ${gr.tema}` : ''}{gr.origen === 'mcp' ? ' · pedido desde Claude' : gr.origen === 'cron' ? ' · automático' : ''}
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                {gr.items.map(g => <Guion key={g.id} g={g} formatos={data.formatos} busy={busy} onPatch={patch} onRegenerar={regenerar} />)}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
