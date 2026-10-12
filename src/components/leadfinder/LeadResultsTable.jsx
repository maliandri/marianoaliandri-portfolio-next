// src/components/leadfinder/LeadResultsTable.jsx
'use client';

const OUTDATED_MS = 18 * 30 * 24 * 60 * 60 * 1000; // ~18 meses

const shortUrl = (url) => (url ? url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 35) : '');
const isOutdated = (iso) => { const ms = Date.parse(iso); return Number.isFinite(ms) && Date.now() - ms > OUTDATED_MS; };
const fmtMonth = (iso, locale) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
};

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="text-fg-600 text-xs">—</span>;
  const cls = score >= 70 ? 'bg-green-500/15 text-green-700 dark:text-green-400'
    : score >= 40 ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
    : 'bg-red-500/15 text-red-700 dark:text-red-400';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>{score}</span>;
}

export function exportLeadsCSV(rows, t) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map(r => [
    r.nombre, r.ciudad, r.tipo, r.canal === 'web' ? t.channelWeb : t.channelWhatsapp,
    r.whatsapp ? `+${r.whatsapp}` : '', r.phone || '', r.email || '', r.siteUrl || '', r.seoScore ?? '',
    r.socialUrl || '', r.rating ?? '', r.ratingCount ?? '', (r.openingHours || []).join(' | '),
    r.lastUpdated ? String(r.lastUpdated).slice(0, 10) : '',
    r.prodState === 'done' ? r.prodCount : '',
    r.prodState === 'done' ? (r.prodConfidence === 'catalogo' ? t.productsCatalog : t.productsEstimated) : '',
  ]);
  const csv = [t.csvHeadersLeads, ...body].map(row => row.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `leads_${Date.now()}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function LeadResultsTable({ rows, perfil, t }) {
  const headers = [t.tableHeaders[0], t.tableHeaders[1], t.colRubro, t.colWeb, 'SEO', t.colContacto, t.colUpdated,
    ...(perfil === 'empresa' ? [t.colProducts] : []), '★', 'Maps'];

  return (
    <div className="bg-card border border-fg/10 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto" style={{ maxHeight: 560, overflowY: 'auto' }}>
        <table className="min-w-full text-sm">
          <thead className="bg-card sticky top-0 z-10">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left text-xs font-medium text-fg-500 uppercase whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-fg/5">
            {rows.map(neg => (
              <tr key={neg.id} className="hover:bg-fg/5">
                <td className="px-3 py-2.5 max-w-[180px]"><div className="text-fg truncate text-xs font-medium" title={neg.nombre}>{neg.nombre}</div></td>
                <td className="px-3 py-2.5 text-xs text-fg-500 whitespace-nowrap">{neg.ciudad}</td>
                <td className="px-3 py-2.5"><span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 rounded-full text-xs whitespace-nowrap">{neg.tipo}</span></td>
                <td className="px-3 py-2.5 max-w-[160px]">
                  {neg.siteUrl
                    ? <a href={neg.siteUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs truncate block" title={neg.siteUrl}>{shortUrl(neg.siteUrl)}</a>
                    : <span className="text-purple-600 dark:text-purple-400 text-xs font-medium">{t.noSiteShort}</span>}
                </td>
                <td className="px-3 py-2.5 text-center"><ScoreBadge score={neg.seoScore} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 max-w-[260px]">
                    {neg.whatsapp && (
                      <a href={`https://wa.me/${neg.whatsapp}`} target="_blank" rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-md bg-green-600 hover:bg-green-500 text-white text-xs font-medium">{t.whatsappBtn}</a>
                    )}
                    {neg.email && <a href={`mailto:${neg.email}`} title={neg.email} className="text-indigo-600 dark:text-indigo-400 text-xs truncate max-w-[160px]">{neg.email}</a>}
                    {!neg.whatsapp && neg.phone && <span className="text-fg-400 text-xs whitespace-nowrap">{neg.phone}</span>}
                    {neg.socialUrl && <a href={neg.socialUrl} target="_blank" rel="noopener noreferrer" className="text-fg-500 hover:text-fg text-xs underline">{t.socialLink}</a>}
                    {!neg.whatsapp && !neg.email && !neg.phone && !neg.socialUrl && <span className="text-fg-600 text-xs">—</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                  {neg.lastUpdated
                    ? <span className={isOutdated(neg.lastUpdated) ? 'text-orange-500' : 'text-fg-400'} title={isOutdated(neg.lastUpdated) ? t.outdatedTitle : undefined}>{fmtMonth(neg.lastUpdated, t.locale)}</span>
                    : <span className="text-fg-600">—</span>}
                </td>
                {perfil === 'empresa' && (
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    {neg.prodState === 'loading' ? <span className="text-fg-500">{t.countingProducts}</span>
                      : neg.prodState === 'done' ? (
                        <span title={neg.prodConfidence === 'catalogo' ? t.productsCatalogTitle : t.productsEstimatedTitle}>
                          <span className="text-fg font-semibold">{neg.prodCount}{neg.prodPartial ? '+' : ''}</span>{' '}
                          <span className={neg.prodConfidence === 'catalogo' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-500'}>
                            {neg.prodConfidence === 'catalogo' ? t.productsCatalog : t.productsEstimated}
                          </span>
                        </span>
                      ) : neg.prodState === 'error' ? <span className="text-red-500">—</span>
                      : <span className="text-fg-600">—</span>}
                  </td>
                )}
                <td className="px-3 py-2.5 text-xs text-yellow-600 dark:text-yellow-500 whitespace-nowrap">{neg.rating ? `★${neg.rating}` : neg.previewRating ? `★${neg.previewRating}` : '—'}</td>
                <td className="px-3 py-2.5">
                  <a href={`https://www.google.com/maps/place/?q=place_id:${neg.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-fg-500 hover:text-fg">Maps</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
