// src/components/leadfinder/LeadSearchHistory.jsx
'use client';

import { useState } from 'react';

export default function LeadSearchHistory({ items, onOpen, onDelete, loadingId, disabled, t }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="bg-card border border-fg/10 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} aria-expanded={open} className="w-full flex items-center justify-between px-5 py-4 hover:bg-fg/5">
        <span className="text-fg font-semibold text-sm">{t.historyToggle(items.length)}</span>
        <span className="text-fg-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="divide-y divide-fg/5 border-t border-fg/10">
          {items.map(h => (
            <div key={h.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-fg text-sm truncate">
                  {(h.ciudades || []).join(', ') || t.noLocation}
                  {h.origen === 'admin' && <span className="ml-2 px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[10px] font-semibold uppercase">{t.adminTag}</span>}
                </p>
                <p className="text-fg-500 text-xs">
                  {h.stats ? t.summary(h.stats) : h.resultCount} · {h.createdAt ? new Date(h.createdAt).toLocaleDateString(t.locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onOpen(h.id)} disabled={disabled || loadingId === h.id}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg">
                  {loadingId === h.id ? '⏳' : t.historyView}
                </button>
                <button onClick={() => onDelete(h.id)} disabled={disabled} className="px-2 py-1.5 text-fg-500 hover:text-red-500 disabled:opacity-40 text-xs" aria-label="Borrar">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
