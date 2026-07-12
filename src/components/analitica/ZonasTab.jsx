'use client';

import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

function ScoreBadge({ score }) {
  if (score == null) return null;
  const color = score < 40 ? '#ef4444' : score < 70 ? '#f59e0b' : '#22c55e';
  return (
    <span style={{ background: color + '22', color, border: `1px solid ${color}44` }}
      className="text-xs font-bold px-2 py-0.5 rounded-full">
      {score}
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

function AuditoriaCard({ a }) {
  const ciudades = (a.config?.ciudades || []).join(', ');
  const barData = [
    { name: 'Débil',     value: a.stats?.lowSeoCount    || 0, fill: '#ef4444' },
    { name: 'Mejorable', value: (a.stats?.total || 0) - (a.stats?.lowSeoCount || 0) - Math.round((a.stats?.total || 0) * 0.3), fill: '#f59e0b' },
    { name: 'Aceptable', value: Math.round((a.stats?.total || 0) * 0.3), fill: '#22c55e' },
  ];

  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden hover:border-indigo-500/30 transition-colors group">
      {/* Header */}
      <div className="p-5 border-b border-white/6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">{a.publishedAt?.slice(0, 10)}</p>
            <h3 className="text-white font-bold text-sm leading-tight line-clamp-2">{a.title}</h3>
          </div>
          <ScoreBadge score={a.stats?.avgSeoScore} />
        </div>
        {ciudades && (
          <p className="text-xs text-indigo-400">📍 {ciudades}</p>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-white/6">
        {[
          { v: a.stats?.total,       l: 'sitios',  c: 'text-white' },
          { v: a.stats?.withEmail,   l: 'con email', c: 'text-green-400' },
          { v: a.stats?.lowSeoCount, l: 'SEO débil', c: 'text-red-400' },
        ].map(({ v, l, c }) => (
          <div key={l} className="py-3 px-4 text-center">
            <p className={`text-xl font-bold ${c}`}>{v ?? '—'}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{l}</p>
          </div>
        ))}
      </div>

      {/* Mini bar chart */}
      {a.stats?.total > 0 && (
        <div className="px-5 pb-4 pt-2">
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {barData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary */}
      {a.summary && (
        <div className="px-5 pb-4">
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{a.summary}</p>
        </div>
      )}

      {/* CTA */}
      <div className="px-5 pb-5">
        <Link
          href={`/auditorias/${a.id}`}
          className="flex items-center justify-center gap-2 w-full bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 hover:border-indigo-500/40 text-indigo-400 text-xs font-semibold py-2.5 rounded-xl transition-colors"
        >
          Ver reporte completo →
        </Link>
      </div>
    </div>
  );
}

export default function ZonasTab({ auditorias = [] }) {
  if (!auditorias.length) return (
    <div className="text-center py-20">
      <p className="text-3xl mb-3">🗺️</p>
      <p className="text-gray-500 text-sm">No hay reportes de zona publicados todavía.</p>
    </div>
  );

  // Agrupar por ciudad
  const byCiudad = auditorias.reduce((acc, a) => {
    const ciudad = (a.config?.ciudades || ['Sin ciudad'])[0];
    if (!acc[ciudad]) acc[ciudad] = [];
    acc[ciudad].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      {/* Resumen global */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Reportes',          value: auditorias.length,                               color: 'text-white' },
          { label: 'Sitios analizados', value: auditorias.reduce((s, a) => s + (a.stats?.total || 0), 0), color: 'text-indigo-400' },
          { label: 'Ciudades',          value: Object.keys(byCiudad).length,                    color: 'text-cyan-400' },
          { label: 'Score promedio',    value: Math.round(auditorias.reduce((s, a) => s + (a.stats?.avgSeoScore || 0), 0) / auditorias.length) || '—', color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#111] border border-white/8 rounded-2xl p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Grid de reportes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {auditorias.map(a => <AuditoriaCard key={a.id} a={a} />)}
      </div>
    </div>
  );
}
