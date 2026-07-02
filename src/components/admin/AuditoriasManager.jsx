'use client';

import { useState, useEffect, useCallback } from 'react';

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-gray-500 text-xs">—</span>;
  const cls = score >= 70 ? 'bg-green-500/15 text-green-400 border-green-500/30'
            : score >= 40 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {score}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditoriasManager() {
  const [auditorias, setAuditorias] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [deleting, setDeleting]     = useState(null);
  const [expanded, setExpanded]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/auditorias');
      const data = await res.json();
      setAuditorias(Array.isArray(data) ? data : []);
    } catch { setAuditorias([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, title) => {
    if (!confirm(`¿Eliminar "${title}"?\nEsta acción no se puede deshacer.`)) return;
    setDeleting(id);
    try {
      await fetch('/api/auditorias', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setAuditorias(prev => prev.filter(a => a.id !== id));
      if (expanded === id) setExpanded(null);
    } catch (e) {
      alert('Error al eliminar: ' + e.message);
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <span className="animate-pulse">Cargando auditorías...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Auditorías publicadas</h2>
          <p className="text-sm text-gray-500 mt-0.5">{auditorias.length} reporte{auditorias.length !== 1 ? 's' : ''} publicado{auditorias.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load}
          className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
          ↻ Recargar
        </button>
      </div>

      {auditorias.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">📊</p>
          <p>No hay auditorías publicadas todavía.</p>
          <p className="text-xs mt-1">Publicá una desde el Lead Finder.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {auditorias.map(a => (
            <div key={a.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">

              {/* Row principal */}
              <div className="flex items-center gap-4 px-5 py-4">

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{a.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {(a.config?.ciudades || []).map(c => (
                      <span key={c} className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                        📍 {c}
                      </span>
                    ))}
                    {a.config?.radioKm && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                        {a.config.radioKm} km
                      </span>
                    )}
                    {(a.config?.tiposLabels || []).slice(0, 5).map(t => (
                      <span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                        {t}
                      </span>
                    ))}
                    {(a.config?.tiposLabels || []).length > 5 && (
                      <span className="text-xs text-gray-400 px-1">+{a.config.tiposLabels.length - 5} más</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{formatDate(a.publishedAt)}</p>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-6 shrink-0">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">{a.stats?.total ?? '—'}</div>
                    <div className="text-xs text-gray-400">sitios</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-500">{a.stats?.lowSeoCount ?? '—'}</div>
                    <div className="text-xs text-gray-400">SEO débil</div>
                  </div>
                  <div className="text-center">
                    <ScoreBadge score={a.stats?.avgSeoScore} />
                    <div className="text-xs text-gray-400 mt-1">prom.</div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpanded(prev => prev === a.id ? null : a.id)}
                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    {expanded === a.id ? '▲ Menos' : '▼ Más'}
                  </button>
                  <a href={`/auditorias/${a.id}`} target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    Ver →
                  </a>
                  <button
                    onClick={() => handleDelete(a.id, a.title)}
                    disabled={deleting === a.id}
                    className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-40">
                    {deleting === a.id ? '...' : '🗑 Eliminar'}
                  </button>
                </div>
              </div>

              {/* Panel expandido */}
              {expanded === a.id && (
                <AuditoriaDetail id={a.id} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SendEmailButton({ neg, auditoriaId }) {
  const [state, setState] = useState('idle'); // idle | loading | sent | error
  const [preview, setPreview] = useState(null);

  const handleSend = async () => {
    if (state === 'sent') return;
    setState('loading');
    try {
      const resp = await fetch('/api/auditorias/send-biz-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auditoriaId,
          nombre:     neg.nombre,
          siteUrl:    neg.siteUrl,
          email:      neg.email,
          seoScore:   neg.seoScore,
          hasSitemap: neg.hasSitemap,
          hasRobots:  neg.hasRobots,
          metaDesc:   neg.metaDesc,
          hasOG:      neg.hasOG,
          ciudad:     neg.ciudad,
          tipo:       neg.tipo,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al enviar');
      setState('sent');
      setPreview(data.emailText);
    } catch (e) {
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  if (!neg.email) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>;

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-green-600 dark:text-green-400 truncate max-w-[120px]" title={neg.email}>
          {neg.email}
        </span>
        <button
          onClick={handleSend}
          disabled={state === 'loading' || state === 'sent'}
          title={state === 'sent' ? 'Enviado' : `Enviar email a ${neg.email}`}
          className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium transition-colors
            ${state === 'sent'    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 cursor-default'
            : state === 'error'   ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
            : state === 'loading' ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-wait'
            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50'}`}>
          {state === 'loading' ? '⏳' : state === 'sent' ? '✓ Enviado' : state === 'error' ? '✗ Error' : '✉ Enviar'}
        </button>
      </div>
      {preview && (
        <details className="text-xs text-gray-400">
          <summary className="cursor-pointer hover:text-gray-600 select-none">Ver texto generado</summary>
          <pre className="mt-1 whitespace-pre-wrap text-gray-500 dark:text-gray-400 text-xs leading-relaxed max-w-xs bg-gray-50 dark:bg-gray-800 p-2 rounded">{preview}</pre>
        </details>
      )}
    </div>
  );
}

function AuditoriaDetail({ id }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/auditorias?id=${id}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-4 text-xs text-gray-400 animate-pulse">
      Cargando detalle...
    </div>
  );
  if (!data) return null;

  const results = [...(data.results || [])].sort((a, b) => (a.seoScore ?? 999) - (b.seoScore ?? 999));
  const withEmail = results.filter(r => r.email).length;

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      {/* Resumen Gemini */}
      {data.summary && (
        <div className="px-5 py-4 bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-widest mb-2">Análisis Gemini</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{data.summary}</p>
        </div>
      )}

      {/* Info emails */}
      {withEmail > 0 && (
        <div className="px-5 py-2.5 bg-green-50/50 dark:bg-green-900/10 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs text-green-700 dark:text-green-400">
            ✉ <strong>{withEmail}</strong> empresa{withEmail !== 1 ? 's' : ''} con email — hacé click en <strong>Enviar</strong> para mandarles un análisis personalizado generado por Gemini
          </p>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto" style={{ maxHeight: '420px' }}>
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {['Negocio', 'Ciudad', 'Sitio web', 'Score', 'Sitemap', 'Robots', 'Meta', 'OG', '★', 'Email'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {results.map((neg, i) => (
              <tr key={neg.id || i} className={`hover:bg-gray-50 dark:hover:bg-gray-700/20 ${neg.email ? 'bg-green-50/30 dark:bg-green-900/5' : ''}`}>
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white max-w-[150px] truncate" title={neg.nombre}>
                  {neg.nombre}
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{neg.ciudad || '—'}</td>
                <td className="px-3 py-2 max-w-[150px]">
                  <a href={neg.siteUrl} target="_blank" rel="noopener noreferrer"
                    className="text-indigo-500 hover:underline truncate block" title={neg.siteUrl}>
                    {(neg.siteUrl || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 30)}
                  </a>
                </td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  {neg.seoScore != null
                    ? <span className={`font-bold ${neg.seoScore >= 70 ? 'text-green-500' : neg.seoScore >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{neg.seoScore}</span>
                    : <span className="text-gray-400">—</span>}
                </td>
                {['hasSitemap','hasRobots','metaDesc','hasOG'].map(k => (
                  <td key={k} className="px-3 py-2 text-center">
                    {neg[k] == null ? <span className="text-gray-300">—</span>
                      : neg[k] ? <span className="text-green-500">✓</span>
                      : <span className="text-red-400">✗</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-center text-yellow-500 whitespace-nowrap">
                  {neg.rating ? `★ ${neg.rating}` : '—'}
                </td>
                <td className="px-3 py-2">
                  <SendEmailButton neg={neg} auditoriaId={id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700">
        {results.length} sitios · {withEmail} con email · ordenados por Score SEO ascendente
      </div>
    </div>
  );
}
