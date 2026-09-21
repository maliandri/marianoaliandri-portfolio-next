'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import SendAuditEmailButton from './SendAuditEmailButton';
import { RUBROS, CATEGORIAS_RUBROS } from '@/data/rubros';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PAGE_SIZE = 50;
const EMPTY_FILTERS = { year: '', month: '', cat: '', seoMin: '', seoMax: '', onlyEmail: false, q: '' };

function catFor(tipoLabel) {
  return RUBROS.find(r => r.label === tipoLabel)?.cat || 'Otros';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Vista consolidada de TODAS las auditorías hechas, sin importar el reporte del
// que vienen — solo para el admin (no se publica). Se nutre de
// /api/auditorias/unificado, que aplana los `results[]` de cada doc de la
// colección `auditorias` y les suma cuántas veces se le envió el mail a cada uno
// (colección `sent_emails`). Cada vez que se publica un nuevo reporte desde el
// Lead Finder, aparece acá automáticamente — no hay que hacer nada extra.
export default function AuditoriasUnificado() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage]       = useState(1);

  // Solo llama setState dentro de la promesa (no sincrónicamente en el cuerpo del
  // efecto) — loading/error ya arrancan en su valor correcto por useState.
  const fetchData = useCallback(() => {
    return fetch('/api/auditorias/unificado')
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d)) throw new Error(d.error || 'Error al cargar');
        setItems(d);
        setError('');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Para el botón "Recargar" — acá sí podemos resetear loading/error sincrónicamente,
  // porque corre desde un click handler, no desde un efecto.
  const reload = () => { setLoading(true); setError(''); fetchData(); };

  const updateFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
    setPage(1);
  };

  const years = useMemo(() => {
    const set = new Set(items.filter(i => i.publishedAt).map(i => new Date(i.publishedAt).getFullYear()));
    return [...set].sort((a, b) => b - a);
  }, [items]);

  const categories = useMemo(() => {
    const present = new Set(items.map(i => catFor(i.tipo)));
    const ordered = CATEGORIAS_RUBROS.filter(c => present.has(c));
    if (present.has('Otros')) ordered.push('Otros');
    return ordered;
  }, [items]);

  const filtered = useMemo(() => {
    const { year, month, cat, seoMin, seoMax, onlyEmail, q } = filters;
    return items.filter(neg => {
      if (year  && (!neg.publishedAt || new Date(neg.publishedAt).getFullYear() !== Number(year)))       return false;
      if (month && (!neg.publishedAt || new Date(neg.publishedAt).getMonth() + 1 !== Number(month)))     return false;
      if (cat   && catFor(neg.tipo) !== cat)                                                              return false;
      if (seoMin !== '' && (neg.seoScore == null || neg.seoScore < Number(seoMin)))                       return false;
      if (seoMax !== '' && (neg.seoScore == null || neg.seoScore > Number(seoMax)))                       return false;
      if (onlyEmail && !neg.email)                                                                        return false;
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        if (!neg.nombre?.toLowerCase().includes(needle) && !neg.ciudad?.toLowerCase().includes(needle)) return false;
      }
      return true;
    });
  }, [items, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const total     = filtered.length;
    const withEmail = filtered.filter(n => n.email).length;
    const withScore = filtered.filter(n => n.seoScore != null);
    const avgSeo    = withScore.length ? Math.round(withScore.reduce((s, n) => s + n.seoScore, 0) / withScore.length) : null;
    const emailsSent = filtered.reduce((s, n) => s + (n.emailsSentCount || 0), 0);
    return { total, withEmail, avgSeo, emailsSent };
  }, [filtered]);

  // Actualiza el contador en memoria apenas se manda un mail, sin esperar a recargar todo.
  const bumpLocalCount = useCallback((email) => {
    if (!email) return;
    setItems(prev => prev.map(n => (n.email || '').toLowerCase() === email.toLowerCase()
      ? { ...n, emailsSentCount: (n.emailsSentCount || 0) + 1, lastEmailSentAt: new Date().toISOString() }
      : n));
  }, []);

  const hasFilters = Object.entries(filters).some(([k, v]) => v !== EMPTY_FILTERS[k]);
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); };

  if (loading) return <div className="p-6 text-sm text-gray-400 animate-pulse">Cargando auditorías...</div>;
  if (error)   return <div className="p-6 text-sm text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Todas las auditorías</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Vista consolidada de todos los reportes hechos — solo vos la ves, no se publica.</p>
        </div>
        <button onClick={reload}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800">
          Recargar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Negocios',        value: stats.total },
          { label: 'Con email',       value: stats.withEmail },
          { label: 'Score SEO prom.', value: stats.avgSeo ?? '—' },
          { label: 'Emails enviados', value: stats.emailsSent },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Año</label>
          <select value={filters.year} onChange={e => updateFilter('year', e.target.value)}
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5">
            <option value="">Todos</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Mes</label>
          <select value={filters.month} onChange={e => updateFilter('month', e.target.value)}
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5">
            <option value="">Todos</option>
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Categoría</label>
          <select value={filters.cat} onChange={e => updateFilter('cat', e.target.value)}
            className="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5">
            <option value="">Todas</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">SEO ≥</label>
          <input type="number" min="0" max="100" value={filters.seoMin} onChange={e => updateFilter('seoMin', e.target.value)}
            className="w-16 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">SEO ≤</label>
          <input type="number" min="0" max="100" value={filters.seoMax} onChange={e => updateFilter('seoMax', e.target.value)}
            className="w-16 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5" />
        </div>
        <div className="flex items-center gap-1.5 pb-1.5">
          <input id="onlyEmail" type="checkbox" checked={filters.onlyEmail} onChange={e => updateFilter('onlyEmail', e.target.checked)} />
          <label htmlFor="onlyEmail" className="text-xs text-gray-500">Solo con email</label>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-1">Buscar</label>
          <input type="text" value={filters.q} onChange={e => updateFilter('q', e.target.value)} placeholder="Nombre o ciudad..."
            className="w-full text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5" />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline pb-1.5">Limpiar filtros</button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-800/40 sticky top-0 z-10">
            <tr className="border-b border-gray-200 dark:border-neutral-800">
              {['Negocio', 'Ciudad', 'Rubro', 'Score', 'Reporte', 'Fecha', 'Email'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {pageItems.map((neg, i) => (
              <tr key={`${neg.reportId}-${neg.id || i}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white max-w-[160px] truncate" title={neg.nombre}>
                  {neg.nombre}
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{neg.ciudad || '—'}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{neg.tipo || '—'}</td>
                <td className="px-3 py-2 text-center whitespace-nowrap">
                  {neg.seoScore != null
                    ? <span className={`font-bold ${neg.seoScore >= 70 ? 'text-green-500' : neg.seoScore >= 40 ? 'text-yellow-500' : 'text-red-500'}`}>{neg.seoScore}</span>
                    : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate" title={neg.reportTitle}>{neg.reportTitle || '—'}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{formatDate(neg.publishedAt)}</td>
                <td className="px-3 py-2">
                  <SendAuditEmailButton
                    neg={neg}
                    auditoriaId={neg.reportId}
                    sentCount={neg.emailsSentCount}
                    lastSentAt={neg.lastEmailSentAt}
                    onSent={bumpLocalCount}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-xs">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 disabled:opacity-40">Anterior</button>
          <span className="text-gray-500">Página {page} de {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 disabled:opacity-40">Siguiente</button>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">{filtered.length} de {items.length} negocios</p>
    </div>
  );
}
