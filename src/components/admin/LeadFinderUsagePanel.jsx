'use client';

import { useState, useEffect } from 'react';

function Bar({ used, cap, color }) {
  const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function LeadFinderUsagePanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const adminPassword = sessionStorage.getItem('adminPassword');
    fetch(`/api/admin-leadfinder-usage?adminPassword=${encodeURIComponent(adminPassword)}`)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl p-4 text-sm mb-4">{error}</div>;
  if (!data) return <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>;

  const { today, days, caps } = data;
  const metrics = [
    { key: 'getPlaceRequests', label: 'Auditorías completas (getPlaceRequest)', color: '#4f46e5', note: 'la que factura — $20/1.000' },
    { key: 'searchNearbyRequests', label: 'Búsquedas por rubro (searchNearby)', color: '#0891b2', note: '' },
    { key: 'searchTextRequests', label: 'Búsquedas por término (searchText)', color: '#0891b2', note: '' },
  ];

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Uso de Google Places — hoy</h3>
        <span className="text-[11px] text-gray-500 dark:text-gray-400">contador propio — Google no expone esta cuota por API</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{today?.date} · {today?.cacheHits || 0} auditorías servidas gratis desde caché</p>

      <div className="space-y-4">
        {metrics.map(m => {
          const used = today?.[m.key] || 0;
          const cap = caps[m.key];
          const over90 = cap && used / cap >= 0.9;
          return (
            <div key={m.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-700 dark:text-gray-300 font-medium">{m.label} {m.note && <span className="text-gray-400 font-normal">({m.note})</span>}</span>
                <span className={`font-mono font-bold ${over90 ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>{used}/{cap}</span>
              </div>
              <Bar used={used} cap={cap} color={over90 ? '#ef4444' : m.color} />
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">Últimos 7 días — getPlaceRequest</p>
        <div className="flex items-end gap-1.5 h-16">
          {days.map(d => {
            const cap = caps.getPlaceRequests;
            const pct = Math.min(100, Math.round((d.getPlaceRequests / cap) * 100));
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${d.date}: ${d.getPlaceRequests}/${cap}`}>
                <div className="w-full rounded-t bg-indigo-500/70 dark:bg-indigo-400/70" style={{ height: `${Math.max(pct, 2)}%` }} />
                <span className="text-[9px] text-gray-400">{d.date.slice(8)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
