'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useProyectos } from '@/hooks/useProyectos';

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

function ScreenshotImage({ src, domain }) {
  const [failed, setFailed] = useState(false);
  const initial = domain.charAt(0).toUpperCase();

  if (failed || !src) {
    return (
      <div className="h-44 bg-[#1a1a2e] flex items-center justify-center">
        <span className="text-5xl font-black text-indigo-500/40">{initial}</span>
      </div>
    );
  }

  return (
    <div className="h-44 overflow-hidden bg-[#111]">
      <img
        src={src}
        alt={`Screenshot de ${domain}`}
        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function ProyectoCard({ proyecto, index }) {
  const tag = getTag(proyecto);
  const domainClean = proyecto.domain.replace(/^sc-domain:/, '');

  return (
    <motion.div
      className="group rounded-2xl bg-[#111] border border-white/10 overflow-hidden hover:border-indigo-500/40 transition-colors duration-300"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
    >
      {/* Screenshot with tag */}
      <div className="relative">
        <ScreenshotImage src={proyecto.screenshotUrl} domain={domainClean} />
        <span className="absolute top-3 right-3 bg-black/70 border border-white/10 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
          {tag}
        </span>
      </div>

      <div className="p-5">
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

        {/* Domain + link */}
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

export default function ProyectosGrid() {
  const { data: proyectos, isLoading, isError } = useProyectos();

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
