'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from 'recharts';
import { useState } from 'react';

const PALETTE = ['#6366f1', '#22d3ee', '#4ade80', '#f59e0b', '#f87171'];

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

function InterestChart({ data = [], keywords = [], color }) {
  if (!data.length) return (
    <p className="text-xs text-gray-600 py-4">Sin datos suficientes para este grupo en Neuquén.</p>
  );

  const chartData = data.slice(-30).map(p => {
    const obj = { date: p.date };
    keywords.slice(0, 5).forEach((kw, i) => {
      // Etiqueta corta: quitar "Neuquén", "Patagonia", etc.
      const short = kw.replace(/ Neuquén| Patagonia| Argentina| oil gas/gi, '').trim();
      obj[short] = p.values?.[i] ?? 0;
    });
    return obj;
  });

  const shortKeys = keywords.slice(0, 5).map(kw =>
    kw.replace(/ Neuquén| Patagonia| Argentina| oil gas/gi, '').trim()
  );

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          {shortKeys.map((_, i) => (
            <linearGradient key={i} id={`g${color}${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={PALETTE[i]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={PALETTE[i]} stopOpacity={0}   />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false}
          tickFormatter={d => d?.replace(/\s\d{4}$/, '')} />
        <YAxis tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 100]} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af', paddingTop: 6 }} />
        {shortKeys.map((kw, i) => (
          <Area key={kw} type="monotone" dataKey={kw} name={kw}
            stroke={PALETTE[i]} fill={`url(#g${color}${i})`} strokeWidth={1.5} dot={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RelatedBlock({ related = {}, label }) {
  const { rising = [], top = [] } = related;
  if (!rising.length && !top.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/6">
      {[
        { tag: '🚀 En ascenso', items: rising },
        { tag: '🔥 Más buscados', items: top },
      ].map(({ tag, items }) => (
        <div key={tag}>
          <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider mb-2">{tag}</p>
          <div className="space-y-1.5">
            {items.slice(0, 6).map((q, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-300 truncate">{q.query}</span>
                <span className="text-[10px] text-gray-600 shrink-0">
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

function SectorCard({ icon, title, accent, data, keywords, related, colorId }) {
  return (
    <div className={`bg-[#111] border rounded-2xl p-6 ${accent}`}>
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xl">{icon}</span>
        <p className="text-sm font-bold text-white">{title}</p>
        <span className="ml-auto text-[10px] text-gray-600 uppercase tracking-wider">Neuquén / Comahue · 90 días</span>
      </div>
      <InterestChart data={data} keywords={keywords} color={colorId} />
      {related && <RelatedBlock related={related} />}
    </div>
  );
}

function GeneralTrends({ trends = [] }) {
  const [open, setOpen] = useState(false);
  if (!trends.length) return null;

  const data = trends.slice(0, 10).map((t, idx) => ({
    name: t.title?.length > 20 ? t.title.slice(0, 20) + '…' : t.title,
    búsquedas: parseInt(t.traffic?.replace(/[^0-9]/g, '') || '0') || (10 - idx) * 10,
  })).reverse();

  return (
    <div className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-sm">📰</span>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Tendencias generales de Argentina hoy
          </p>
        </div>
        <svg className={`w-4 h-4 text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }}
                tickLine={false} axisLine={false} width={130} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
              <Bar dataKey="búsquedas" fill="#374151" radius={[0, 6, 6, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function TrendsTab({ trends, region = 'neuquen' }) {
  const data = trends?.[region] || trends?.neuquen;

  if (!trends || !data) return (
    <div className="text-center py-20">
      <p className="text-3xl mb-3">📡</p>
      <p className="text-gray-500 text-sm">Sin datos de tendencias todavía.</p>
      <p className="text-gray-700 text-xs mt-2">El cron actualiza el cache diariamente a las 7am.</p>
    </div>
  );

  const {
    dailyTrends          = [],
    interestConstruccion = [],
    interestComercio     = [],
    interestPetroleo     = [],
    interestDigital      = [],
    relatedConstruccion  = {},
    relatedPetroleo      = {},
    keywordsConstruccion = [],
    keywordsComercio     = [],
    keywordsPetroleo     = [],
    keywordsDigital      = [],
  } = data;

  const sectors = [
    {
      icon: '🏗️', title: 'Construcción, arquitectura & diseño',
      accent: 'border-amber-500/20',
      data: interestConstruccion, keywords: keywordsConstruccion,
      related: relatedConstruccion, colorId: 'A',
    },
    {
      icon: '🛢️', title: 'Petróleo & Vaca Muerta',
      accent: 'border-orange-500/20',
      data: interestPetroleo, keywords: keywordsPetroleo,
      related: relatedPetroleo, colorId: 'B',
    },
    {
      icon: '🛍️', title: 'Comercio local — tecnología, autos & indumentaria',
      accent: 'border-cyan-500/20',
      data: interestComercio, keywords: keywordsComercio,
      related: null, colorId: 'C',
    },
    {
      icon: '💻', title: 'Servicios digitales',
      accent: 'border-indigo-500/20',
      data: interestDigital, keywords: keywordsDigital,
      related: null, colorId: 'D',
    },
  ];

  return (
    <div className="space-y-6">

      {/* Header info */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">
            Interés de búsqueda en <span className="text-white font-semibold">Neuquén / Comahue</span> · Últimos 90 días · Fuente: Google Trends
          </p>
        </div>
        <p className="text-xs text-gray-600">Actualizado: {trends.date}</p>
      </div>

      {/* 4 sectores */}
      {sectors.map(s => (
        <SectorCard key={s.title} {...s} />
      ))}

      {/* Tendencias generales — colapsado */}
      <GeneralTrends trends={dailyTrends} />
    </div>
  );
}
