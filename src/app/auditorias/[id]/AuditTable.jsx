'use client';

import { useState, useMemo } from 'react';

function ScoreBadge({ score }) {
  if (score == null) return <span className="text-gray-600 text-xs">—</span>;
  const cls = score >= 70 ? 'bg-green-500/15 text-green-400 border-green-500/30'
            : score >= 40 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={`inline-flex items-center justify-center min-w-[2.25rem] text-xs font-bold px-2 py-1 rounded-full border ${cls}`}>
      {score}
    </span>
  );
}

// Color de acento por severidad del score (barra izquierda de cada fila)
function bandColor(s) {
  if (s == null) return 'transparent';
  return s >= 70 ? '#22c55e' : s >= 40 ? '#f59e0b' : '#ef4444';
}

function Check({ val }) {
  if (val === null || val === undefined) return <span className="text-gray-700 text-xs">—</span>;
  return val
    ? <span className="text-green-500 text-sm">✓</span>
    : <span className="text-red-500 text-sm">✗</span>;
}

function shortUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 45);
}

const COLS = [
  { key: '#',          label: '#',          sortKey: null,           align: 'left' },
  { key: 'nombre',     label: 'Negocio',    sortKey: 'nombre',       align: 'left' },
  { key: 'ciudad',     label: 'Ciudad',     sortKey: 'ciudad',       align: 'left' },
  { key: 'siteUrl',    label: 'Sitio web',  sortKey: null,           align: 'left' },
  { key: 'seoScore',   label: 'Score',      sortKey: 'seoScore',     align: 'center' },
  { key: 'hasSitemap', label: 'Sitemap',    sortKey: 'hasSitemap',   align: 'center' },
  { key: 'hasRobots',  label: 'Robots',     sortKey: 'hasRobots',    align: 'center' },
  { key: 'metaDesc',   label: 'Meta',       sortKey: 'metaDesc',     align: 'center' },
  { key: 'hasOG',      label: 'OG',         sortKey: 'hasOG',        align: 'center' },
  { key: 'lastMod',    label: 'Actualizado',sortKey: 'lastModified', align: 'left' },
  { key: 'rating',     label: '★',          sortKey: 'rating',       align: 'center' },
  { key: 'email',      label: 'Email',      sortKey: null,           align: 'left', adminOnly: true },
];

function sortValue(neg, sortKey) {
  switch (sortKey) {
    case 'seoScore':      return neg.seoScore ?? -1;
    case 'nombre':        return (neg.nombre || '').toLowerCase();
    case 'ciudad':        return (neg.ciudad || '').toLowerCase();
    case 'lastModified':  return neg.lastModified ? new Date(neg.lastModified).getTime() : 0;
    case 'rating':        return neg.rating ? parseFloat(neg.rating) : -1;
    case 'hasSitemap':    return neg.hasSitemap === true ? 1 : neg.hasSitemap === false ? 0 : -1;
    case 'hasRobots':     return neg.hasRobots === true ? 1 : neg.hasRobots === false ? 0 : -1;
    case 'metaDesc':      return neg.metaDesc ? 1 : neg.metaDesc === null ? -1 : 0;
    case 'hasOG':         return neg.hasOG === true ? 1 : neg.hasOG === false ? 0 : -1;
    default:              return 0;
  }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}
// ¿El sitio es uno del portfolio de Mariano (verificado en GSC)?
function isOwnSite(url, ownDomains) {
  if (!ownDomains?.length) return false;
  const h = hostOf(url);
  return h && ownDomains.some(d => h === d || h.endsWith('.' + d));
}

export default function AuditTable({ results, ownDomains = [], showEmail = false }) {
  const [sortCol, setSortCol] = useState('seoScore');
  const [sortDir, setSortDir] = useState('asc');
  const cols = showEmail ? COLS : COLS.filter(c => !c.adminOnly);

  const sorted = useMemo(() => {
    if (!sortCol) return results;
    return [...results].sort((a, b) => {
      const va = sortValue(a, sortCol);
      const vb = sortValue(b, sortCol);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [results, sortCol, sortDir]);

  const handleSort = (key) => {
    if (!key) return;
    if (sortCol === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
  };

  const arrow = (key) => {
    if (!key || sortCol !== key) return <span className="text-gray-700 ml-1">↕</span>;
    return <span className="text-indigo-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {cols.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.sortKey)}
                  className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap
                    ${col.sortKey ? 'cursor-pointer hover:text-gray-300 select-none' : ''}
                    ${col.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {col.label}{col.sortKey && arrow(col.sortKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sorted.map((neg, i) => {
              const own = isOwnSite(neg.siteUrl, ownDomains);
              return (
              <tr key={neg.id || i} className={`transition-colors ${own ? 'bg-indigo-500/[0.08] hover:bg-indigo-500/[0.14]' : `hover:bg-white/[0.05] ${i % 2 ? 'bg-white/[0.015]' : ''}`}`}>
                <td className="px-4 py-3.5 text-gray-600 text-xs" style={{ boxShadow: `inset 3px 0 0 ${own ? '#6366f1' : bandColor(neg.seoScore)}` }}>{i + 1}</td>
                <td className="px-4 py-3 max-w-[220px]">
                  <div className="font-medium text-white truncate" title={neg.nombre}>{neg.nombre}</div>
                  {own && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      ★ Hecho por mí
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">{neg.ciudad || '—'}</td>
                <td className="px-4 py-3 max-w-[200px]">
                  <a href={neg.siteUrl} target="_blank" rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 text-xs truncate block transition-colors"
                    title={neg.siteUrl}>
                    {shortUrl(neg.siteUrl)}
                  </a>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <ScoreBadge score={neg.seoScore} />
                </td>
                <td className="px-4 py-3 text-center"><Check val={neg.hasSitemap} /></td>
                <td className="px-4 py-3 text-center"><Check val={neg.hasRobots} /></td>
                <td className="px-4 py-3 text-center"><Check val={neg.metaDesc != null ? !!neg.metaDesc : null} /></td>
                <td className="px-4 py-3 text-center"><Check val={neg.hasOG} /></td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {neg.lastModified
                    ? new Date(neg.lastModified).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-yellow-500 text-center whitespace-nowrap">
                  {neg.rating ? `★ ${neg.rating}` : '—'}
                </td>
                {showEmail && (
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap max-w-[180px] truncate" title={neg.email || ''}>
                    {neg.email || '—'}
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
