'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

const METRICS = [
  { icon: '🌐', value: '10+',   label: 'Sitios publicados' },
  { icon: '📈', value: '+50k',  label: 'Visitas generadas' },
  { icon: '🔍', value: 'Top 10', label: 'Posición en Google' },
];

// Escena de scroll (referencia latitudnomade.com, 2026-11-25): en escritorio la portada queda fija y, al bajar, se
// achica hasta quedar dentro de la pantalla de una notebook ("así se ve tu negocio en internet"). Solo
// transform/opacity; en celular o con "reducir movimiento" es la portada estática. En reposo (scroll 0) se pinta igual
// que antes: el h1 (LCP) no cambia.
export default function HeroNew() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const [escritorio, setEscritorio] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const f = () => setEscritorio(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const activa = escritorio && !reduce;

  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const escala = useTransform(p, [0, 0.55], [1, 0.62]);
  const marco = useTransform(p, [0.08, 0.45], [0, 1]);
  const pie = useTransform(p, [0.55, 0.8], [0, 1]);
  const pieY = useTransform(p, [0.55, 0.8], [16, 0]);

  return (
    <div ref={ref} className="relative lg:h-[220vh]">
      <div className="lg:sticky lg:top-0 lg:h-[100dvh] lg:overflow-hidden lg:flex lg:items-center lg:justify-center">
        <motion.div className="relative w-full lg:h-full" style={activa ? { scale: escala } : undefined}>
          {activa && (
            <motion.div aria-hidden style={{ opacity: marco }} className="pointer-events-none absolute inset-0 z-10 rounded-[2rem] border-[18px] border-neutral-900 dark:border-neutral-700 shadow-[0_50px_100px_-30px_rgba(0,0,0,0.6)]">
              <div className="absolute -top-[15px] left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-neutral-800 px-5 py-1.5">
                <span className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-green-400/80" /></span>
                <span className="font-mono text-sm text-fg-400">🔒 tunegocio.com.ar</span>
              </div>
            </motion.div>
          )}
          <HeroContenido />
        </motion.div>
        {activa && (
          <>
            {/* base de la notebook, justo debajo de la pantalla achicada (62% → borde inferior al 81% del alto) */}
            <motion.div aria-hidden style={{ opacity: marco }} className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[81%] w-[72vw] h-4 rounded-b-[2rem] bg-gradient-to-b from-neutral-600 to-neutral-900">
              <span className="absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-28 rounded-b-lg bg-neutral-800" />
            </motion.div>
            <motion.p style={{ opacity: pie, y: pieY }} className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[87%] w-max max-w-[90vw] text-center text-lg text-fg-300">
              Así se ve tu negocio en internet: <span className="text-fg font-semibold">hecho a medida y fácil de encontrar en Google.</span>
            </motion.p>
          </>
        )}
      </div>
    </div>
  );
}

function HeroContenido() {
  return (
    <section className="hero-glow min-h-screen lg:h-full bg-page flex flex-col items-center justify-center px-6 text-center pt-20 pb-16 overflow-hidden">

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
