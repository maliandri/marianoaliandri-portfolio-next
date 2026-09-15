'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useProyectos } from '@/hooks/useProyectos';

const RANGE_PRESETS = [
  { key: '5d',  label: 'Últimos 5 días',  days: 5,  lag: 3 },
  { key: '26d', label: 'Últimos 26 días', days: 26, lag: 3 },
  { key: '3m',  label: 'Últimos 3 meses', days: 90, lag: 2 },
];

function formatNum(n) {
  if (!n && n !== 0) return '–';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function getTag(proyecto) {
  const stack = proyecto.stack?.toLowerCase() || '';
  if (stack.includes('seo') && stack.includes('next')) return 'SEO + Web';
  if (stack.includes('seo')) return 'SEO';
  if (stack.includes('next') || stack.includes('react')) return 'Web + Diseño';
  if (proyecto.clicks > 500) return 'Web + Posicionamiento';
  return 'Diseño + Web';
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-[#111] border border-white/10 overflow-hidden animate-pulse">
      <div className="h-44 bg-white/5" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-white/10 rounded w-2/3" />
        <div className="h-3 bg-white/5 rounded w-1/2" />
        <div className="flex gap-4 pt-3">
          <div className="h-3 bg-white/10 rounded w-16" />
          <div className="h-3 bg-white/10 rounded w-16" />
          <div className="h-3 bg-white/10 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

function ScreenshotImage({ src, fallbackSrc, domain }) {
  const [step, setStep] = useState(0); // 0 = primaria (Cloudinary), 1 = fallback (live), 2 = agotado
  const initial = domain.charAt(0).toUpperCase();
  const currentSrc = step === 0 ? src : step === 1 ? fallbackSrc : null;

  if (step === 2 || !currentSrc) {
    return (
      <div className="h-44 bg-[#1a1a2e] flex items-center justify-center">
        <span className="text-5xl font-black text-indigo-500/40">{initial}</span>
      </div>
    );
  }

  return (
    <div className="h-44 overflow-hidden bg-[#111]">
      <img
        src={currentSrc}
        alt={`Screenshot de ${domain}`}
        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        onError={() => setStep(s => s + 1)}
      />
    </div>
  );
}

function ProyectoCard({ proyecto, index }) {
  const tag = getTag(proyecto);
  const domainClean = proyecto.domain.replace(/^sc-domain:/, '');
  // Sin barra final: el dominio tiene puntos, Next.js lo trata como path
  // tipo archivo y redirige a sacarla igual (ver commit de la página nueva).
  const detailHref = `/proyectos/${domainClean}`;

  return (
    <motion.div
      className="group rounded-2xl bg-[#111] border border-white/10 overflow-hidden hover:border-indigo-500/40 transition-colors duration-300"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      <Link href={detailHref} className="block">
        {/* Screenshot with tag */}
        <div className="relative">
          <ScreenshotImage src={proyecto.screenshotUrl} fallbackSrc={proyecto.screenshotFallbackUrl} domain={domainClean} />
          <span className="absolute top-3 right-3 bg-black/70 border border-white/10 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
            {tag}
          </span>
        </div>

        <div className="px-5 pt-5">
          {/* Name + description */}
          <h3 className="font-bold text-white text-base truncate">
            {proyecto.descripcionCorta?.split('·')[0]?.trim() || domainClean}
          </h3>
          <p className="text-gray-500 text-sm mt-0.5 truncate">
            {proyecto.descripcionCorta || domainClean}
          </p>

          {/* GSC Metrics */}
          <div className="flex items-center gap-5 mt-4">
            <div className="flex flex-col items-start">
              <span className="text-white font-bold text-sm">{formatNum(proyecto.clicks)}</span>
              <span className="text-gray-600 text-xs">Clicks</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-white font-bold text-sm">{formatNum(proyecto.impressions)}</span>
              <span className="text-gray-600 text-xs">Impresiones</span>
            </div>
            {proyecto.position && (
              <div className="flex flex-col items-start">
                <span className="text-white font-bold text-sm">{Number(proyecto.position).toFixed(1)}</span>
                <span className="text-gray-600 text-xs">Posición</span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Domain + external link — fuera del Link de arriba: un <a> no puede anidarse dentro de otro <a> */}
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
          <span className="text-gray-600 text-xs truncate">{domainClean}</span>
          <a
            href={proyecto.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-white transition-colors ml-2 flex-shrink-0"
            aria-label={`Ver ${domainClean}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </motion.div>
  );
}

function ProyectosChart({ proyectos }) {
  const data = [...proyectos]
    .sort((a, b) => (b.impressions || 0) - (a.impressions || 0))
    .map(p => ({
      domain: p.domain.replace(/^sc-domain:/, '').replace(/\.com(\.ar)?$/, ''),
      impressions: p.impressions,
      clicks: p.clicks,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="domain" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={{ stroke: 'rgba(255,255,255,0.1)' }} tickLine={false} />
        <YAxis yAxisId="imp" orientation="left" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
        <YAxis yAxisId="clk" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip
          contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}
          itemStyle={{ padding: 0 }}
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af', paddingTop: 8 }} iconType="circle" iconSize={8} />
        <Bar yAxisId="imp" dataKey="impressions" name="Impresiones" fill="#4338ca" radius={[6, 6, 0, 0]} maxBarSize={44} />
        <Bar yAxisId="clk" dataKey="clicks" name="Clicks" fill="#a5b4fc" radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RangeSelector({ value, onChange }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-2 pt-4 border-t border-white/5">
      {RANGE_PRESETS.map(p => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={`text-xs font-medium px-3.5 py-1.5 rounded-full transition-colors ${
            value === p.key
              ? 'bg-indigo-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export default function ProyectosGrid() {
  const [rangeKey, setRangeKey] = useState('26d');
  const preset = RANGE_PRESETS.find(p => p.key === rangeKey) || RANGE_PRESETS[1];
  const { data: proyectos, isLoading, isError } = useProyectos(preset.days, preset.lag);

  return (
    <section id="proyectos" className="bg-[#0a0a0a] px-6 py-20 md:py-28">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <p className="text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Trabajos recientes
          </p>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
              Resultados reales,<br />clientes reales
            </h2>
            <p className="text-gray-500 text-sm max-w-xs leading-relaxed">
              Datos extraídos de Google Search Console. Cada sitio posicionado orgánicamente sin publicidad paga.
            </p>
          </div>
        </div>

        {isError && (
          <p className="text-center text-sm text-red-400 mb-8">
            No se pudieron cargar los proyectos.
          </p>
        )}

        {/* Chart: clicks + impresiones por sitio, con selector de rango */}
        {!isError && (
          <div className="bg-[#111] border border-white/10 rounded-2xl p-5 md:p-6 mb-10">
            {isLoading && !proyectos ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ProyectosChart proyectos={proyectos || []} />
            )}
            <RangeSelector value={rangeKey} onChange={setRangeKey} />
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : proyectos?.map((p, i) => <ProyectoCard key={p.domain} proyecto={p} index={i} />)
          }
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 flex flex-col md:flex-row items-center justify-between gap-6 bg-[#111] border border-white/10 rounded-2xl px-8 py-6"
        >
          <div>
            <p className="text-white font-bold text-lg">¿Tu negocio no aparece en Google?</p>
            <p className="text-gray-500 text-sm mt-1">Hablemos. Primera consulta sin cargo.</p>
          </div>
          <a
            href="#contact"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
          >
            Pedir presupuesto <span aria-hidden>→</span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
