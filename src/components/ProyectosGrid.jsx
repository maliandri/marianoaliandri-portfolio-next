'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useProyectos } from '@/hooks/useProyectos';

function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-200 dark:bg-gray-700" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
        <div className="flex gap-4 pt-2">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        </div>
      </div>
    </div>
  );
}

function ScreenshotImage({ src, domain }) {
  const [failed, setFailed] = useState(false);
  const initial = domain.charAt(0).toUpperCase();

  if (failed) {
    return (
      <div className="h-48 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center">
        <span className="text-5xl font-bold text-indigo-400 dark:text-indigo-500">{initial}</span>
      </div>
    );
  }

  return (
    <div className="h-48 overflow-hidden bg-gray-100 dark:bg-gray-700">
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

function formatNum(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function ProyectoCard({ proyecto, index }) {
  return (
    <motion.div
      className="group rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <ScreenshotImage src={proyecto.screenshotUrl} domain={proyecto.domain} />

      <div className="p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
          {proyecto.domain}
        </h3>

        {proyecto.descripcionCorta ? (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
            {proyecto.descripcionCorta}
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-600 italic">
            Sin descripción
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
          <span title="Clicks últimos 28 días">
            <span className="font-medium text-indigo-600 dark:text-indigo-400">{formatNum(proyecto.clicks)}</span> clicks
          </span>
          <span title="Impresiones últimos 28 días">
            <span className="font-medium text-purple-600 dark:text-purple-400">{formatNum(proyecto.impressions)}</span> imp.
          </span>
        </div>

        <a
          href={proyecto.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
        >
          Ver sitio
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </motion.div>
  );
}

export default function ProyectosGrid() {
  const { data: proyectos, isLoading, isError } = useProyectos();

  return (
    <motion.section
      id="proyectos"
      className="p-8 md:p-12 rounded-3xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-50">
          Proyectos Realizados
        </h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Sitios web desarrollados y optimizados para clientes reales
        </p>
      </div>

      {isError && (
        <p className="text-center text-sm text-red-500 dark:text-red-400">
          No se pudieron cargar los proyectos.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : proyectos?.map((p, i) => <ProyectoCard key={p.domain} proyecto={p} index={i} />)
        }
      </div>
    </motion.section>
  );
}
