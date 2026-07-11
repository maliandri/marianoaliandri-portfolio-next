'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from 'recharts';

const PALETTE = ['#6366f1', '#22d3ee', '#4ade80', '#f59e0b', '#f87171'];

function KpiCard({ label, value, sub, color = 'text-indigo-400' }) {
  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-xs shadow-xl">
      <p className="text-gray-400 mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

function TrendingList({ trends = [] }) {
  if (!trends.length) return <p className="text-gray-600 text-sm">Sin datos disponibles.</p>;
  return (
    <div className="space-y-2">
      {trends.slice(0, 10).map((t, i) => (
        <div key={i} className="flex items-center gap-3 bg-[#111] border border-white/6 rounded-xl px-4 py-3 hover:border-indigo-500/30 transition-colors">
          <span className="text-gray-600 font-mono text-xs w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">{t.title}</p>
            {t.relatedQueries?.length > 0 && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{t.relatedQueries.slice(0, 3).join(' · ')}</p>
            )}
          </div>
          <span className="text-xs text-indigo-400 font-bold shrink-0">{t.traffic}</span>
        </div>
      ))}
    </div>
  );
}

function InterestChart({ data = [], keywords = [] }) {
  if (!data.length) return <p className="text-gray-600 text-sm">Sin datos de evolución.</p>;
  // Limit to last 30 points for readability
  const sliced = data.slice(-30);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={sliced} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          {keywords.slice(0, 5).map((_, i) => (
            <linearGradient key={i} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PALETTE[i]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={PALETTE[i]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false}
          tickFormatter={d => d?.slice(5)} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }} />
        {keywords.slice(0, 5).map((kw, i) => (
          <Area key={kw} type="monotone" dataKey={`values[${i}]`} name={kw}
            stroke={PALETTE[i]} fill={`url(#grad${i})`} strokeWidth={1.5} dot={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TopTermsChart({ trends = [] }) {
  if (!trends.length) return null;
  const data = trends
    .slice(0, 10)
    .map(t => ({
      name: t.title?.length > 18 ? t.title.slice(0, 18) + '…' : t.title,
      búsquedas: parseInt(t.traffic?.replace(/[^0-9]/g, '') || '0') || (10 - trends.indexOf(t)) * 10,
    }))
    .reverse();

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
        <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fill: '#d1d5db', fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
        <Bar dataKey="búsquedas" fill="#6366f1" radius={[0, 6, 6, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RelatedQueries({ related = {} }) {
  const { rising = [], top = [] } = related;
  if (!rising.length && !top.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[{ label: '🚀 En ascenso', items: rising }, { label: '🔥 Más buscados', items: top }].map(({ label, items }) => (
        <div key={label} className="bg-[#111] border border-white/8 rounded-2xl p-5">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">{label}</p>
          <div className="space-y-2">
            {items.slice(0, 8).map((q, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-300 truncate">{q.query}</span>
                <span className="text-xs text-gray-500 shrink-0">
                  {typeof q.value === 'number' && q.value > 0 ? `+${q.value}%` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TrendsTab({ trends, region = 'neuquen' }) {
  const data = trends?.[region];

  if (!trends || !data) return (
    <div className="text-center py-20">
      <p className="text-3xl mb-3">📡</p>
      <p className="text-gray-500 text-sm">Sin datos de tendencias todavía.</p>
      <p className="text-gray-700 text-xs mt-2">El cron corre todos los días a las 7am y actualiza el cache.</p>
    </div>
  );

  const { dailyTrends = [], interestOverTime = [], relatedQueries = {}, keywords = [] } = data;

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Tendencias hoy" value={dailyTrends.length} color="text-white" />
        <KpiCard label="Actualización" value={trends.date || '—'} sub="Diaria · 7am" color="text-indigo-400" />
        <KpiCard label="Términos relacionados"
          value={(relatedQueries.rising?.length || 0) + (relatedQueries.top?.length || 0)}
          color="text-cyan-400" />
        <KpiCard label="Período análisis" value="90 días" sub="Evolución histórica" color="text-green-400" />
      </div>

      {/* Bar chart — Top términos */}
      <div className="bg-[#111] border border-white/8 rounded-2xl p-6">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">Top búsquedas del día</p>
        <TopTermsChart trends={dailyTrends} />
      </div>

      {/* Lista detallada */}
      <div>
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">Tendencias detalladas</p>
        <TrendingList trends={dailyTrends} />
      </div>

      {/* Related queries */}
      {(relatedQueries.rising?.length > 0 || relatedQueries.top?.length > 0) && (
        <div>
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">Queries relacionados — servicios digitales</p>
          <RelatedQueries related={relatedQueries} />
        </div>
      )}

      {/* Interest over time */}
      {interestOverTime.length > 0 && (
        <div className="bg-[#111] border border-white/8 rounded-2xl p-6">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">Evolución de interés — últimos 90 días</p>
          <InterestChart data={interestOverTime} keywords={keywords} />
          <p className="text-xs text-gray-600 mt-3">Índice 0–100 · Fuente: Google Trends</p>
        </div>
      )}
    </div>
  );
}
