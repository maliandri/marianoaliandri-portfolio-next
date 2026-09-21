'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

function formatFetchedAt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function FreeForDevBrowser() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [query, setQuery]     = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  const debounceRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/free-for-dev');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al cargar');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 150);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const filteredCategories = useMemo(() => {
    if (!data) return [];
    if (!debouncedQuery) return data.categories;
    return data.categories
      .map(cat => {
        const catMatches = cat.name.toLowerCase().includes(debouncedQuery);
        const items = catMatches ? cat.items : cat.items.filter(it =>
          it.name.toLowerCase().includes(debouncedQuery) || it.desc.toLowerCase().includes(debouncedQuery)
        );
        return { ...cat, items };
      })
      .filter(cat => cat.items.length > 0);
  }, [data, debouncedQuery]);

  const resultCount = useMemo(
    () => filteredCategories.reduce((a, c) => a + c.items.length, 0),
    [filteredCategories]
  );

  const toggleCat = name => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const isOpen = name => !!debouncedQuery || expanded.has(name);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Free for Dev</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {data.total} recursos · {data.categories.length} categorías · fuente:{' '}
              <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                ripienaar/free-for-dev
              </a>
            </p>
          </div>
          <button
            onClick={load}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 text-sm font-medium transition-colors"
          >
            Actualizar
          </button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2">
          Se trae en vivo del repo (caché de 6h) — el repo tiene actividad constante, así que esto siempre refleja una versión reciente.
          Última carga: {formatFetchedAt(data.fetchedAt)}
        </p>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre, categoría o descripción…"
          className="mt-4 w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {debouncedQuery && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{resultCount} resultados para “{debouncedQuery}”</p>
        )}
      </div>

      {/* Categorías */}
      <div className="space-y-3">
        {filteredCategories.map(cat => {
          const open = isOpen(cat.name);
          return (
            <div key={cat.name} className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
              <button
                onClick={() => toggleCat(cat.name)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors text-left"
              >
                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{cat.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500">{cat.items.length}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </button>

              {open && (
                <div className="border-t border-gray-100 dark:border-neutral-800 divide-y divide-gray-100 dark:divide-neutral-800/70">
                  {cat.items.map((it, i) => (
                    <a
                      key={i}
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-5 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{it.name}</span>
                      {it.desc && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{it.desc}</span>
                      )}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
            Sin resultados para “{debouncedQuery}”.
          </div>
        )}
      </div>
    </div>
  );
}
