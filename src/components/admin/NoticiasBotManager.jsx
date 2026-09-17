'use client';

import { useState, useEffect, useCallback } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function NoticiasBotManager() {
  const [topics, setTopics]     = useState([]);
  const [config, setConfig]     = useState({ active: true, dailyCap: null });
  const [log, setLog]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [newQuery, setNewQuery] = useState('');
  const [capInput, setCapInput] = useState('');
  const [busy, setBusy]         = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, cRes, lRes] = await Promise.all([
        fetch('/api/noticias/topics'),
        fetch('/api/noticias/config'),
        fetch('/api/noticias'),
      ]);
      const [tData, cData, lData] = await Promise.all([tRes.json(), cRes.json(), lRes.json()]);
      setTopics(tData.topics || []);
      setConfig({ active: cData.active !== false, dailyCap: cData.dailyCap ?? null });
      setCapInput(cData.dailyCap != null ? String(cData.dailyCap) : '');
      setLog(lData.noticias || []);
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async () => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await fetch('/api/noticias/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !config.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(c => ({ ...c, active: data.active }));
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveCap = async () => {
    setBusy(true); setErrorMsg('');
    try {
      const dailyCap = capInput.trim() === '' ? null : Number(capInput);
      const res = await fetch('/api/noticias/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dailyCap }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setConfig(c => ({ ...c, dailyCap: data.dailyCap }));
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const addTopic = async () => {
    if (!newLabel.trim()) return;
    setBusy(true); setErrorMsg('');
    try {
      const res = await fetch('/api/noticias/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel.trim(), query: newQuery.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNewLabel(''); setNewQuery('');
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = async (id, activo) => {
    setBusy(true); setErrorMsg('');
    try {
      const res = await fetch('/api/noticias/topics', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, activo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      setErrorMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-gray-400 animate-pulse">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Noticias (Bot)</h2>
        <p className="text-xs text-gray-500">Corre cada hora en GitHub Actions, fuera de Vercel. No se publica nada acá — es control del bot.</p>
      </div>

      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}

      {/* Interruptor general + tope diario */}
      <div className="flex flex-wrap items-center gap-6 bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.active} disabled={busy} onChange={toggleActive} />
          <span className={config.active ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-gray-500'}>
            {config.active ? 'Bot activo' : 'Bot pausado'}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Tope diario</label>
          <input
            type="number" min="1" value={capInput}
            onChange={e => setCapInput(e.target.value)}
            placeholder="sin tope"
            className="w-20 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5"
          />
          <button onClick={saveCap} disabled={busy}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50">
            Guardar
          </button>
        </div>
      </div>

      {/* Tópicos */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Tópicos a seguir</p>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="Ej: inteligencia artificial"
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 flex-1 min-w-[160px]"
          />
          <input
            type="text" value={newQuery} onChange={e => setNewQuery(e.target.value)}
            placeholder="query de búsqueda (opcional, si difiere del nombre)"
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 flex-1 min-w-[200px]"
          />
          <button onClick={addTopic} disabled={busy || !newLabel.trim()}
            className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
            + Agregar
          </button>
        </div>
        <div className="space-y-1.5">
          {topics.length === 0 && <p className="text-xs text-gray-400">Sin tópicos todavía.</p>}
          {topics.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-3 text-xs bg-gray-50 dark:bg-gray-800/40 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <span className="font-medium text-gray-900 dark:text-white">{t.label}</span>
                {t.query !== t.label && <span className="text-gray-400 ml-2">({t.query})</span>}
              </div>
              <label className="flex items-center gap-1.5 shrink-0">
                <input type="checkbox" checked={t.activo} disabled={busy} onChange={e => toggleTopic(t.id, e.target.checked)} />
                <span className={t.activo ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>{t.activo ? 'Activo' : 'Inactivo'}</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Log */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Últimas publicaciones</p>
        {log.length === 0 ? (
          <p className="text-xs text-gray-400">Todavía no publicó nada.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['Tópico', 'Título', 'Estado', 'Fecha'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {log.map(n => (
                  <tr key={n.id}>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{n.topicLabel || '—'}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-white max-w-[260px] truncate" title={n.title}>
                      <a href={`/noticias/${n.id}/`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {n.title || '—'}
                      </a>
                      {n.sourceUrl && (
                        <>
                          {' · '}
                          <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline text-[11px]">
                            fuente
                          </a>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {n.status === 'published'
                        ? (n.makeError
                            ? <span className="text-amber-600 dark:text-amber-400" title={`Make falló: ${n.makeError}`}>⚠ Publicada (Make falló)</span>
                            : <span className="text-green-600 dark:text-green-400">✓ Publicada</span>)
                        : <span className="text-red-500" title={n.makeError || 'Error'}>✗ Error</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(n.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
