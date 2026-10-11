'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const METRICS = [
  { icon: '🌐', value: '10+',   label: 'Sitios publicados' },
  { icon: '📈', value: '+50k',  label: 'Visitas generadas' },
  { icon: '🔍', value: 'Top 10', label: 'Posición en Google' },
];

export default function HeroNew() {
  return (
    <section className="hero-glow min-h-screen bg-page flex flex-col items-center justify-center px-6 text-center pt-20 pb-16">

      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 border border-indigo-500/40 rounded-full px-4 py-1.5 mb-10"
      >
        <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
        <span className="text-sm text-indigo-700 dark:text-indigo-300 font-medium">Disponible para nuevos proyectos</span>
      </motion.div>

      {/* Headline: sin animación de opacidad — es el elemento LCP, debe pintarse
          de inmediato en vez de esperar a que Framer Motion hidrate (ver auditoría
          PageSpeed Insights, LCP mobile 8.3s -> "element render delay" 1935ms) */}
      <h1 className="text-5xl md:text-7xl font-black text-fg leading-[1.05] max-w-4xl mb-6 tracking-tight">
        Sitios web que aparecen en{' '}
        <span className="text-gradient">Google</span>{' '}
        y generan clientes
      </h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="text-lg text-fg-400 max-w-lg mb-10 leading-relaxed"
      >
        Diseño, desarrollo y posicionamiento para negocios argentinos que quieren crecer en internet.
      </motion.p>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-wrap gap-4 justify-center mb-20"
      >
        <Link
          href="#proyectos"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3.5 glow-btn"
        >
          Ver portfolio <span aria-hidden>→</span>
        </Link>
        <Link
          href="/presupuesto"
          className="flex items-center gap-2 border border-fg/20 hover:border-fg/50 text-fg font-semibold px-8 py-3.5 pill-btn transition-colors duration-200"
        >
          Pedir presupuesto
        </Link>
      </motion.div>

      {/* Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="grid grid-cols-3 gap-4 max-w-2xl w-full"
      >
        {METRICS.map((m) => (
          <div
            key={m.label}
            className="glow-frame bg-card border border-fg/10 rounded-2xl p-6 flex flex-col items-center gap-2"
          >
            <span className="text-2xl" aria-hidden>{m.icon}</span>
            <span className="text-2xl font-bold text-fg">{m.value}</span>
            <span className="text-xs text-fg-500">{m.label}</span>
          </div>
        ))}
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-16 flex flex-col items-center gap-1 text-fg-600 text-xs"
      >
        <span>SCROLL</span>
        <div className="w-px h-8 bg-fg/10" />
      </motion.div>
    </section>
  );
}
