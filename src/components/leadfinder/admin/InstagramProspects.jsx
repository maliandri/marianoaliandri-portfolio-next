// Prospectos de Instagram (solo admin). Con `leads` muestra los de la búsqueda actual que tienen
// @; sin `leads`, todos los guardados en ig_prospectos para hacer el seguimiento.
// El DM se manda a mano: "Copiar y abrir chat" copia el texto y abre ig.me/m/<handle>.
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { ESTADOS } from '@/lib/igProspectos';

const ESTADO_CLS = {
  pendiente:  'bg-fg/10 text-fg-400',
  contactado: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  respondio:  'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  cliente:    'bg-green-500/15 text-green-600 dark:text-green-400',
  descartado: 'bg-red-500/10 text-red-500',
};

function Fila({ row, saved, busy, onGenerar, onPatch }) {
  const handle = row.instagram || row.handle;
  const estado = saved?.estado || 'pendiente';
  const [dm, setDm] = useState(saved?.dm || '');
  const [notas, setNotas] = useState(saved?.notas || '');
  const [copiado, setCopiado] = useState(false);
  useEffect(() => { setDm(saved?.dm || ''); }, [saved?.dm]);
  useEffect(() => { setNotas(saved?.notas || ''); }, [saved?.notas]);

  const abrirChat = async () => {
    try { await navigator.clipboard.writeText(dm); setCopiado(true); setTimeout(() => setCopiado(false), 2500); } catch { /* sin portapapeles */ }
    window.open(`https://ig.me/m/${handle}`, '_blank', 'noopener');
    if (estado === 'pendiente') onPatch(handle, { estado: 'contactado' });
  };

  return (
    <li className="p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
          className="px-2 py-0.5 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-xs font-medium">@{handle}</a>
        <span className="text-sm text-fg font-medium truncate max-w-[220px]" title={row.nombre}>{row.nombre}</span>
        <span className="text-xs text-fg-500">{[row.ciudad, row.tipo].filter(Boolean).join(' · ')}</span>
        {typeof row.seoScore === 'number' && <span className="text-xs text-fg-500">SEO {row.seoScore}</span>}
        {!row.siteUrl && <span className="text-xs text-purple-600 dark:text-purple-400">sin web</span>}
        {typeof row.demanda?.interes === 'number' && (
          <span className="text-xs text-orange-600 dark:text-orange-400" title={(row.demanda.ejemplos || []).join(' · ')}>🔥 {row.demanda.interes}</span>
        )}
        <select value={estado} disabled={!saved} onChange={e => onPatch(handle, { estado: e.target.value })}
          aria-label={`Estado de @${handle}`}
          className={`ml-auto text-xs rounded-lg px-2 py-1 border-0 disabled:opacity-40 ${ESTADO_CLS[estado]}`}>
          {ESTADOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      {saved?.dm ? (
        <>
          <textarea value={dm} rows={3} onChange={e => setDm(e.target.value)}
            onBlur={() => dm !== saved.dm && onPatch(handle, { dm })}
            aria-label={`DM para @${handle}`}
            className="w-full text-sm bg-fg/5 border border-fg/10 rounded-xl px-3 py-2 text-fg resize-y" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={abrirChat} disabled={!dm.trim()}
              className="px-3 py-1.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg">
              {copiado ? '✓ Copiado — pegalo en el chat' : 'Copiar y abrir chat'}
            </button>
            <button type="button" onClick={() => onGenerar(row, true)} disabled={busy}
              className="px-3 py-1.5 bg-fg/5 hover:bg-fg/10 disabled:opacity-40 text-fg text-xs rounded-lg">
              {busy ? 'Generando…' : 'Otro texto'}
            </button>
            <span className="text-[11px] text-fg-500">{dm.length} caracteres{saved.dmSource === 'plantilla' ? ' · plantilla (Gemini no respondió)' : ''}</span>
            <input value={notas} onChange={e => setNotas(e.target.value)}
              onBlur={() => notas !== (saved.notas || '') && onPatch(handle, { notas })}
              placeholder="Notas (qué respondió, próximo paso…)" aria-label={`Notas de @${handle}`}
              className="flex-1 min-w-[180px] text-xs bg-transparent border-b border-fg/10 px-1 py-1 text-fg" />
          </div>
        </>
      ) : (
        <button type="button" onClick={() => onGenerar(row, false)} disabled={busy}
          className="px-3 py-1.5 bg-fg/5 hover:bg-fg/10 disabled:opacity-40 text-fg text-xs rounded-lg">
          {busy ? 'Generando DM…' : '✨ Generar DM'}
        </button>
      )}
    </li>
  );
}

export default function InstagramProspects({ leads = null }) {
  const { user, getIdToken } = useAuthUser();
  const [saved, setSaved] = useState({}); // handle → doc
  const [busy, setBusy] = useState({});   // handle → true
  const [filtro, setFiltro] = useState('todos');
  const [error, setError] = useState(null);

  const api = useCallback(async (method, body) => {
    const idToken = await getIdToken();
    const resp = await fetch('/api/ig-prospectos', {
      method,
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || `Error ${resp.status}`);
    return data;
  }, [getIdToken]);

  useEffect(() => {
    if (!user) return;
    api('GET')
      .then(d => setSaved(Object.fromEntries((d.items || []).map(i => [i.handle, i]))))
      .catch(e => setError(e.message));
  }, [user, api]);

  const guardar = (item) => setSaved(s => ({ ...s, [item.handle]: item }));

  const generar = useCallback(async (row, regenerar) => {
    const lead = row.instagram ? row : { ...row, instagram: row.handle, id: row.placeId };
    setBusy(b => ({ ...b, [lead.instagram]: true }));
    setError(null);
    try { guardar((await api('POST', { lead, regenerar })).item); }
    catch (e) { setError(e.message); }
    finally { setBusy(b => ({ ...b, [lead.instagram]: false })); }
  }, [api]);

  const patch = useCallback(async (handle, cambios) => {
    setSaved(s => ({ ...s, [handle]: { ...s[handle], ...cambios } })); // optimista
    try { guardar((await api('PATCH', { handle, ...cambios })).item); }
    catch (e) { setError(e.message); }
  }, [api]);

  const filas = useMemo(() => {
    if (leads) return leads.filter(l => l.instagram);
    const todos = Object.values(saved);
    return filtro === 'todos' ? todos : todos.filter(p => (p.estado || 'pendiente') === filtro);
  }, [leads, saved, filtro]);

  const sinDm = filas.filter(r => !saved[r.instagram || r.handle]?.dm);
  const generarTodos = async () => { for (const r of sinDm) await generar(r, false); };

  const conteo = useMemo(() => {
    const c = {};
    for (const p of Object.values(saved)) c[p.estado || 'pendiente'] = (c[p.estado || 'pendiente'] || 0) + 1;
    return c;
  }, [saved]);

  if (!user) return null;
  if (leads && filas.length === 0) return null;

  return (
    <div className="bg-card border border-fg/10 rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-fg/10">
        <h3 className="text-fg font-semibold text-sm">📸 Prospectos de Instagram</h3>
        <span className="text-xs text-fg-500">
          {leads ? `${filas.length} de esta búsqueda tienen Instagram` : `${Object.keys(saved).length} guardados`}
        </span>
        {sinDm.length > 0 && (
          <button type="button" onClick={generarTodos} disabled={Object.values(busy).some(Boolean)}
            className="ml-auto px-3 py-1.5 bg-pink-600 hover:bg-pink-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg">
            ✨ Generar {sinDm.length} DM{sinDm.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {!leads && (
        <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b border-fg/10">
          {[{ id: 'todos', label: 'Todos' }, ...ESTADOS].map(s => (
            <button key={s.id} type="button" onClick={() => setFiltro(s.id)} aria-pressed={filtro === s.id}
              className={`px-2.5 py-1 rounded-full text-xs ${filtro === s.id ? 'bg-pink-600 text-white' : 'bg-fg/5 text-fg-400 hover:bg-fg/10'}`}>
              {s.label} {s.id === 'todos' ? Object.keys(saved).length : (conteo[s.id] || 0)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="px-5 py-2 text-xs text-red-500" role="alert">{error}</p>}

      <p className="px-5 pt-3 text-[11px] text-fg-500">
        Mandalos a mano y de a poco (10–15 por día): Instagram bloquea las cuentas que mandan muchos DMs iguales seguidos. Antes de escribirles, seguilos y comentá algún post.
      </p>

      {filas.length === 0 ? (
        <p className="px-5 py-6 text-sm text-fg-500">
          {leads ? '' : 'Todavía no hay prospectos. Buscá negocios en el Lead Finder y generá DMs para los que tienen Instagram.'}
        </p>
      ) : (
        <ul className="divide-y divide-fg/5">
          {filas.map(r => {
            const h = r.instagram || r.handle;
            return <Fila key={h} row={r} saved={saved[h]} busy={!!busy[h]} onGenerar={generar} onPatch={patch} />;
          })}
        </ul>
      )}
    </div>
  );
}
