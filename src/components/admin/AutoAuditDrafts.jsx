'use client';

import { useState, useEffect, useCallback } from 'react';
import SenalesBadges from './SenalesBadges';

const NETWORK_LABELS = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook' };
const MIN_SITIOS = 3;

// Lotes de la auditoría automática esperando revisión (auditoria_auto_borradores). Nada es público
// hasta "Aprobar": ahí se guarda el informe sin los sitios destildados y, si se pide, sale en redes.
export default function AutoAuditDrafts({ authFetch, refreshKey }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await authFetch('/api/auditoria-auto/borradores/');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los borradores');
      setItems(data.items || []);
    } catch (e) {
      setError(e.message);
    }
  }, [authFetch]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-800 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
        Para revisar {items?.length ? `(${items.length})` : ''}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Lotes que todavía no son públicos. Destildá los sitios que no son del rubro y aprobá, o descartá el lote.
        Claude también los ve (list_audit_drafts / review_audit_draft).
      </p>
      {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
      {items === null && !error && <p className="text-sm text-gray-500">Cargando…</p>}
      {items?.length === 0 && <p className="text-sm text-gray-500">No hay lotes pendientes.</p>}
      <div className="space-y-5">
        {items?.map(b => <Draft key={b.id} b={b} authFetch={authFetch} onDone={load} />)}
      </div>
    </div>
  );
}

function Draft({ b, authFetch, onDone }) {
  const [fuera, setFuera] = useState(() => new Set());
  const [redes, setRedes] = useState(true);
  const [networks, setNetworks] = useState(b.networks);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const quedan = b.results.length - fuera.size;
  const toggle = (id) => setFuera(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const send = async (body, okMsg) => {
    setBusy(true); setMsg(''); setError('');
    try {
      const res = await authFetch('/api/auditoria-auto/borradores/', { method: 'POST', body: JSON.stringify({ id: b.id, ...body }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falló');
      setMsg(okMsg(data));
      setTimeout(onDone, 2500);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const aprobar = () => send(
    { accion: 'aprobar', excluir: [...fuera], redes, networks },
    d => `Publicado: /auditorias/${d.auditoriaId}${d.estado === 'post_fallido' ? ` — redes: ${d.error}` : ''}`,
  );
  const descartar = () => {
    const motivo = window.prompt('¿Por qué lo descartás? (opcional)', '');
    if (motivo === null) return;
    send({ accion: 'descartar', motivo }, () => 'Descartado');
  };

  const q = b.busqueda || {};
  const locs = Object.entries(q.porLocalidad || {});
  const scores = b.results.filter(r => !fuera.has(r.id) && typeof r.seoScore === 'number').map(r => r.seoScore);
  const prom = scores.length ? Math.round(scores.reduce((a, x) => a + x, 0) / scores.length) : '—';

  return (
    <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-white">
          {b.rubro} · {b.ciudad}
          <span className="ml-2 text-xs font-normal text-gray-400">{b.creado && new Date(b.creado).toLocaleString('es-AR')}</span>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Google encontró <b>{q.encontrados ?? '?'}</b> · examinados <b>{q.examinados ?? '?'}</b> · con web <b>{q.conWeb ?? b.results.length}</b>
          {' · '}en el informe <b>{quedan}</b> (SEO prom. {prom})
        </p>
      </div>

      {locs.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          {locs.map(([c, v]) => `${c}: ${v.examinados} examinados, ${v.conWeb} con web, ${v.descartados} sin web`).join(' · ')}
        </p>
      )}
      {q.intentos?.length > 1 && (
        <p className="mt-1 text-xs text-gray-500">
          Intentos: {q.intentos.map(t => `${t.rubro} · ${t.ciudad}: ${t.encontrados ?? '?'} encontrados, ${t.conWeb} con web`).join(' → ')}
        </p>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500">
              <th className="py-1 pr-2"><span className="sr-only">Incluir</span></th>
              <th className="py-1 pr-2">Negocio</th>
              <th className="py-1 pr-2">Ciudad</th>
              <th className="py-1 pr-2">Sitio</th>
              <th className="py-1 pr-2">SEO</th>
              <th className="py-1 pr-2">★</th>
              <th className="py-1 pr-2">Señales</th>
              <th className="py-1">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {b.results.map(r => (
              <tr key={r.id} className={fuera.has(r.id) ? 'opacity-40' : ''}>
                <td className="py-1 pr-2">
                  <input type="checkbox" aria-label={`Incluir ${r.nombre}`} checked={!fuera.has(r.id)} onChange={() => toggle(r.id)} disabled={busy} />
                </td>
                <td className="py-1 pr-2 text-gray-900 dark:text-gray-100">{r.nombre}</td>
                <td className="py-1 pr-2 text-gray-500">{r.ciudad}</td>
                <td className="py-1 pr-2">
                  <a href={r.siteUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">
                    {String(r.siteUrl || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                </td>
                <td className={`py-1 pr-2 font-semibold ${r.seoScore < 50 ? 'text-red-600' : 'text-green-600'}`}>{r.seoScore}</td>
                <td className="py-1 pr-2 text-gray-500">{r.rating ?? '—'}</td>
                <td className="py-1 pr-2"><SenalesBadges neg={r} /></td>
                <td className="py-1 text-xs text-gray-500">{r.email || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={redes} onChange={e => setRedes(e.target.checked)} disabled={busy} />
          Anunciar en redes
        </label>
        {redes && Object.entries(NETWORK_LABELS).map(([k, label]) => (
          <label key={k} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={networks.includes(k)} disabled={busy}
              onChange={() => setNetworks(n => (n.includes(k) ? (n.length > 1 ? n.filter(x => x !== k) : n) : [...n, k]))} />
            {label}
          </label>
        ))}
        <span className="flex-1" />
        <button onClick={descartar} disabled={busy}
          className="px-3 py-2 rounded-lg text-sm border border-red-300 text-red-600 disabled:opacity-50">Descartar</button>
        <button onClick={aprobar} disabled={busy || quedan < MIN_SITIOS}
          title={quedan < MIN_SITIOS ? `Hacen falta al menos ${MIN_SITIOS} sitios` : undefined}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white disabled:opacity-50">
          {busy ? 'Publicando…' : `Aprobar y publicar (${quedan})`}
        </button>
      </div>
      {msg && <p className="mt-2 text-sm text-green-700 dark:text-green-400" role="status">{msg}</p>}
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  );
}
