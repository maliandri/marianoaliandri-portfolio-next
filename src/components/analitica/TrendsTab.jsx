'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend, Cell,
} from 'recharts';
import { useState } from 'react';

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

function InterestChart({ data = [], keywords = [], title }) {
  if (!data.length) return <p className="text-gray-600 text-sm">Sin datos de evolución.</p>;

  const chartData = data.slice(-30).map(p => {
    const obj = { date: p.date };
    keywords.slice(0, 5).forEach((kw, i) => { obj[kw] = p.values?.[i] ?? 0; });
    return obj;
  });

  // Etiqueta corta: "restaurante Neuquén" → "restaurante"
  const shortLabel = kw => kw.replace(/ Neuquén| Patagonia| Argentina/gi, '').trim();

  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl p-6">
      {title && <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-4">{title}</p>}
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
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
          <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }}
            formatter={shortLabel} />
          {keywords.slice(0, 5).map((kw, i) => (
            <Area key={kw} type="monotone" dataKey={kw} name={kw}
              stroke={PALETTE[i]} fill={`url(#grad${i})`} strokeWidth={1.5} dot={false} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-600 mt-2">Índice 0–100 · Fuente: Google Trends</p>
    </div>
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

function GeneralTrends({ trends = [] }) {
  const [open, setOpen] = useState(false);
  if (!trends.length) return null;

  const data = trends.slice(0, 10).map(t => ({
    name: t.title?.length > 18 ? t.title.slice(0, 18) + '…' : t.title,
    búsquedas: parseInt(t.traffic?.replace(/[^0-9]/g, '') || '0') || (10 - trends.indexOf(t)) * 10,
  })).reverse();

  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-500">📰</span>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tendencias generales de Argentina hoy</p>
        </div>
        <svg className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-6">
          <p className="text-xs text-gray-600 mb-4">Noticias, deportes y cultura — contexto general, no comercial.</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="búsquedas" fill="#374151" radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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

  const {
    dailyTrends      = [],
    interestComercios = [],
    interestTrends   = [],
    relatedQueries   = {},
    keywordsComercios = [],
    keywordsTrends   = [],
  } = data;

  const totalRelated = (relatedQueries.rising?.length || 0) + (relatedQueries.top?.length || 0);

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Rubros monitoreados" value={keywordsComercios.length || 5} color="text-white" />
        <KpiCard label="Actualización" value={trends.date || '—'} sub="Diaria · 7am" color="text-indigo-400" />
        <KpiCard label="Términos relacionados" value={totalRelated} color="text-cyan-400" />
        <KpiCard label="Período análisis" value="90 días" sub="Evolución histórica" color="text-green-400" />
      </div>

      {/* HERO: interés en rubros comerciales */}
      {interestComercios.length > 0 && (
        <InterestChart
          data={interestComercios}
          keywords={keywordsComercios}
          title="📈 Interés en rubros comerciales — últimos 90 días"
        />
      )}

      {/* Related queries — lo que la gente busca junto a esos rubros */}
      {totalRelated > 0 && (
        <div>
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-3">
            🔍 Qué buscan junto a estos rubros
          </p>
          <RelatedQueries related={relatedQueries} />
        </div>
      )}

      {/* Segunda dimensión: tendencias del sector digital */}
      {interestTrends.length > 0 && (
        <InterestChart
          data={interestTrends}
          keywords={keywordsTrends}
          title="💡 Tendencias digitales en la región"
        />
      )}

      {/* Tendencias generales — colapsado por defecto */}
      <GeneralTrends trends={dailyTrends} />
    </div>
  );
}
