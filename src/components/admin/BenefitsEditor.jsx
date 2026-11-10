'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { adminFetch } from '@/utils/adminFetch';

// Catálogo de la tienda (Firestore `tienda_catalogo`): precios, textos, dependencias y qué piezas están activas.
// Una web se arma con piezas que no se pisan: base + secciones + módulos. `requiere` = piezas que se agregan
// solas ("a|b" = alguna de las dos). Los paquetes viejos quedan desactivados.

const TIPOS = [['base', 'Base'], ['seccion', 'Sección'], ['modulo', 'Módulo']];
const VACIA = { id: '', categoria: '', tipo: 'modulo', label: '', desc: '', benefit: '', priceUSD: 0, requiere: [], porUnidad: false, activo: true };
const cajita = 'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500';

export default function BenefitsEditor() {
  const [items, setItems] = useState([]);
  const [fuente, setFuente] = useState('firestore');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [abiertas, setAbiertas] = useState(new Set());
  const [editando, setEditando] = useState(null); // pieza en edición (copia)
  const [nueva, setNueva] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [precioDraft, setPrecioDraft] = useState({});

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: true }), 3500); };

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/tienda-catalogo/');
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error');
      setItems(d.items || []);
      setFuente(d.fuente);
      setError('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const llamar = async (method, body, url = '/api/tienda-catalogo/') => {
    const res = await adminFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'Error');
    return d;
  };

  const sembrar = async () => {
    try {
      const d = await llamar('POST', { accion: 'sembrar' });
      flash(d.yaExistia ? 'Ya estaba cargado' : `Cargadas ${d.sembrados} piezas en Firestore`);
      await cargar();
    } catch (e) { flash(e.message, false); }
  };

  const guardarPrecio = async (s) => {
    const draft = precioDraft[s.id];
    if (draft === undefined || Number(draft) === s.priceUSD) return;
    try {
      await llamar('PATCH', { id: s.id, priceUSD: Number(draft) });
      setItems(prev => prev.map(i => i.id === s.id ? { ...i, priceUSD: Number(draft) } : i));
      setPrecioDraft(prev => { const n = { ...prev }; delete n[s.id]; return n; });
      flash('Precio guardado');
    } catch (e) { flash(e.message, false); }
  };

  const toggleActivo = async (s) => {
    try {
      await llamar('PATCH', { id: s.id, activo: !s.activo });
      setItems(prev => prev.map(i => i.id === s.id ? { ...i, activo: !s.activo } : i));
    } catch (e) { flash(e.message, false); }
  };

  const guardarPieza = async (p) => {
    try {
      const orden = nueva ? Math.max(0, ...items.map(i => i.orden || 0)) + 1 : p.orden;
      await llamar('PUT', { ...p, orden, requiere: Array.isArray(p.requiere) ? p.requiere : String(p.requiere || '').split(',') });
      flash('Guardado');
      setEditando(null); setNueva(false);
      await cargar();
    } catch (e) { flash(e.message, false); }
  };

  const borrar = async (s) => {
    if (!window.confirm(`¿Borrar "${s.label}"? Si ya está en presupuestos viejos seguirán viéndose, pero no se podrá volver a elegir.`)) return;
    try { await llamar('DELETE', null, `/api/tienda-catalogo/?id=${encodeURIComponent(s.id)}`); flash('Borrada'); await cargar(); }
    catch (e) { flash(e.message, false); }
  };

  const categorias = useMemo(() => {
    const q = search.trim().toLowerCase();
    const orden = [...items].sort((a, b) => a.orden - b.orden)
      .filter(s => !q || `${s.label} ${s.desc} ${s.id}`.toLowerCase().includes(q));
    const m = new Map();
    for (const s of orden) { if (!m.has(s.categoria)) m.set(s.categoria, []); m.get(s.categoria).push(s); }
    return [...m];
  }, [items, search]);

  const activos = items.filter(s => s.activo);
  const valorTotal = activos.reduce((t, s) => t + (s.priceUSD || 0), 0);
  const nombreDe = (id) => items.find(i => i.id === id)?.label || id;

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <p className="text-sm text-red-500 py-6">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Catálogo de la tienda</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {activos.length} piezas activas de {items.length} · suma de todo el catálogo{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">USD {valorTotal.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {msg.text && <span className={`text-xs font-medium ${msg.ok ? 'text-green-500' : 'text-red-400'}`}>{msg.text}</span>}
          <input type="text" placeholder="Buscar pieza..." value={search}
            onChange={e => { setSearch(e.target.value); if (e.target.value) setAbiertas(new Set(categorias.map(([c]) => c))); }}
            className={`${cajita} w-44`} />
          <button onClick={() => { setNueva(true); setEditando({ ...VACIA }); }}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">+ Nueva pieza</button>
        </div>
      </div>

      {fuente === 'codigo' && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            El catálogo todavía <b>no está en Firestore</b>: la tienda usa el del código. Cargalo para poder editarlo desde acá (incluye los precios que ya tenías editados).
          </p>
          <button onClick={sembrar} className="text-xs px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium">Cargar catálogo inicial en Firestore</button>
        </div>
      )}

      {editando && (
        <PiezaForm pieza={editando} nueva={nueva} categorias={[...new Set(items.map(i => i.categoria))]}
          onCancel={() => { setEditando(null); setNueva(false); }} onSave={guardarPieza} />
      )}

      <div className="space-y-2">
        {categorias.map(([cat, lista]) => {
          const abierta = abiertas.has(cat) || !!search;
          return (
            <div key={cat} className="border border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
              <button onClick={() => setAbiertas(prev => { const n = new Set(prev); n.has(cat) ? n.delete(cat) : n.add(cat); return n; })}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-left">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{cat}</span>
                  <span className="text-xs text-gray-400">{lista.length} piezas</span>
                </span>
                <span className="text-gray-400 text-xs">{abierta ? '▲' : '▼'}</span>
              </button>
              {abierta && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-700/50 text-xs text-gray-400 uppercase tracking-wide">
                        <th className="text-left px-4 py-2 font-semibold">Pieza</th>
                        <th className="text-left px-3 py-2 font-semibold w-[90px]">Tipo</th>
                        <th className="text-left px-3 py-2 font-semibold">Requiere</th>
                        <th className="text-right px-3 py-2 font-semibold w-[100px]">Precio USD</th>
                        <th className="px-3 py-2 font-semibold w-[70px] text-center">Activa</th>
                        <th className="px-3 py-2 w-[110px]" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
                      {lista.map(s => (
                        <tr key={s.id} className={s.activo ? '' : 'opacity-50'}>
                          <td className="px-4 py-2.5 align-top">
                            <span className="font-medium text-gray-900 dark:text-white">{s.label}</span>
                            {s.porUnidad && <span className="ml-1.5 text-[10px] text-indigo-500">por unidad</span>}
                            <span className="block text-xs text-gray-500 leading-snug">{s.desc}</span>
                            <span className="block text-[10px] text-gray-400 font-mono">{s.id}</span>
                          </td>
                          <td className="px-3 py-2.5 align-top text-xs text-gray-500">{TIPOS.find(t => t[0] === s.tipo)?.[1]}</td>
                          <td className="px-3 py-2.5 align-top text-xs text-gray-500">
                            {s.requiere.length ? s.requiere.map(r => r.split('|').map(nombreDe).join(' o ')).join(' · ') : '—'}
                          </td>
                          <td className="px-3 py-2.5 align-top text-right">
                            <input type="number" min="0" step="1" aria-label={`Precio en USD de ${s.label}`}
                              value={precioDraft[s.id] ?? s.priceUSD}
                              onChange={e => setPrecioDraft(prev => ({ ...prev, [s.id]: e.target.value }))}
                              onBlur={() => guardarPrecio(s)}
                              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                              className="w-20 text-right bg-transparent border border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus:border-indigo-400 rounded-lg px-1.5 py-1 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 focus:outline-none" />
                          </td>
                          <td className="px-3 py-2.5 align-top text-center">
                            <input type="checkbox" checked={s.activo} onChange={() => toggleActivo(s)} aria-label={`Activar ${s.label}`} disabled={fuente === 'codigo'} className="h-4 w-4 accent-indigo-600" />
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <div className="flex flex-col items-end gap-1">
                              <button onClick={() => { setNueva(false); setEditando({ ...s }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} disabled={fuente === 'codigo'}
                                className="text-[11px] text-indigo-500 hover:text-indigo-400 disabled:opacity-40">Editar</button>
                              <button onClick={() => borrar(s)} disabled={fuente === 'codigo'} className="text-[10px] text-gray-400 hover:text-red-400 disabled:opacity-40">Borrar</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PiezaForm({ pieza, nueva, categorias, onCancel, onSave }) {
  const [p, setP] = useState({ ...pieza, requiere: (pieza.requiere || []).join(', ') });
  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(p); }} className="rounded-2xl border border-indigo-400/40 bg-indigo-50/40 dark:bg-indigo-900/10 p-4 grid gap-3 md:grid-cols-2">
      <h3 className="md:col-span-2 text-sm font-bold text-gray-900 dark:text-white">{nueva ? 'Nueva pieza' : `Editar: ${pieza.label}`}</h3>
      <label className="text-xs text-gray-500 grid gap-1">Id (no se puede cambiar después)
        <input required disabled={!nueva} value={p.id} onChange={e => set('id', e.target.value.toLowerCase())} placeholder="sec_nueva" className={cajita} />
      </label>
      <label className="text-xs text-gray-500 grid gap-1">Nombre
        <input required value={p.label} onChange={e => set('label', e.target.value)} className={cajita} />
      </label>
      <label className="text-xs text-gray-500 grid gap-1">Categoría
        <input required list="cats-tienda" value={p.categoria} onChange={e => set('categoria', e.target.value)} className={cajita} />
        <datalist id="cats-tienda">{categorias.map(c => <option key={c} value={c} />)}</datalist>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-gray-500 grid gap-1">Tipo
          <select value={p.tipo} onChange={e => set('tipo', e.target.value)} className={cajita}>
            {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500 grid gap-1">Precio USD
          <input required type="number" min="0" step="1" value={p.priceUSD} onChange={e => set('priceUSD', e.target.value)} className={cajita} />
        </label>
      </div>
      <label className="text-xs text-gray-500 grid gap-1 md:col-span-2">Qué incluye (descripción corta)
        <input value={p.desc} onChange={e => set('desc', e.target.value)} className={cajita} />
      </label>
      <label className="text-xs text-gray-500 grid gap-1 md:col-span-2">Beneficio (texto que ve el cliente al elegirla y va en el presupuesto)
        <textarea rows={2} value={p.benefit} onChange={e => set('benefit', e.target.value)} className={cajita} />
      </label>
      <label className="text-xs text-gray-500 grid gap-1 md:col-span-2">Requiere (ids separados por coma; "a|b" = alguna de las dos)
        <input value={p.requiere} onChange={e => set('requiere', e.target.value)} placeholder="base_sitio, db_firestore|db_supabase" className={cajita} />
      </label>
      <div className="md:col-span-2 flex flex-wrap items-center gap-5">
        <label className="text-xs text-gray-500 flex items-center gap-2"><input type="checkbox" checked={!!p.porUnidad} onChange={e => set('porUnidad', e.target.checked)} className="accent-indigo-600" /> Se pide por cantidad (ej. páginas extra)</label>
        <label className="text-xs text-gray-500 flex items-center gap-2"><input type="checkbox" checked={p.activo !== false} onChange={e => set('activo', e.target.checked)} className="accent-indigo-600" /> Activa en la tienda</label>
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5">Cancelar</button>
        <button type="submit" className="text-xs px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium">Guardar</button>
      </div>
    </form>
  );
}
