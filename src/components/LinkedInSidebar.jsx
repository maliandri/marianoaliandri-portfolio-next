'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { linkedinPosts } from '../data/linkedinPosts';

const INTERVAL_MS = 7000;
const WHATSAPP_NUMBER = '5492995414422';

const slideVariants = {
  enter: { opacity: 0, y: 20 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export default function LinkedInSidebar() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  const post = linkedinPosts[currentIndex];
  const total = linkedinPosts.length;

  // Auto-colapsar cuando se navega a cualquier sección/herramienta
  useEffect(() => {
    const isHomePage = pathname === '/';
    if (!isHomePage) {
      setIsCollapsed(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total);
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPlaying, total]);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const handleWhatsApp = useCallback(() => {
    const msg = encodeURIComponent(
      `Hola Mariano! Vi el Día ${post.day} de tu serie LinkedIn: "${post.problema}" — Me interesa saber más.`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, '_blank');
  }, [post]);

  return (
    <>
    {/* Botón móvil para expandir/contraer */}
    <button
      onClick={() => setMobileExpanded(!mobileExpanded)}
      className="linkedin-mobile-toggle"
      aria-label={mobileExpanded ? 'Cerrar LinkedIn 30 Días' : 'Ver LinkedIn 30 Días'}
    >
      <div className="w-5 h-5 rounded bg-[#0A66C2] flex items-center justify-center">
        <span className="text-white text-[9px] font-bold">in</span>
      </div>
      <span className="linkedin-toggle-badge">{post.day}</span>
    </button>

    {/* Panel móvil expandible */}
    <AnimatePresence>
      {mobileExpanded && (
        <motion.div
          className="linkedin-mobile-panel"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          <button
            onClick={() => setMobileExpanded(false)}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <span className="text-gray-600 dark:text-gray-300 text-lg">✕</span>
          </button>

          {/* Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded bg-[#0A66C2] flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">in</span>
            </div>
            <span className="text-sm font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              30 Días
            </span>
          </div>

          {/* Content Card */}
          <div className="rounded-xl bg-white/90 dark:bg-gray-800/90 border border-gray-200/60 dark:border-gray-700/60 shadow-lg overflow-hidden">
            {/* Timer bar */}
            <motion.div
              key={`mobile-timer-${currentIndex}`}
              className="h-[3px] bg-gradient-to-r from-[#0A66C2] to-[#4c01f9]"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: INTERVAL_MS / 1000, ease: 'linear' }}
            />

            <div className="p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`mobile-${currentIndex}`}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex flex-col gap-3"
                >
                  {/* Day badge */}
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4c01f9] to-[#0A66C2] text-white text-sm font-bold flex items-center justify-center shrink-0">
                      {post.day}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                      Día {post.day} de {total}
                    </span>
                  </div>

                  {/* Problema */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-red-500/80 dark:text-red-400/80 font-bold mb-1">
                      Problema
                    </p>
                    <p className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                      {post.problema}
                    </p>
                  </div>

                  {/* Solución */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 font-bold mb-1">
                      Solución
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">
                      {post.propuesta}
                    </p>
                  </div>

                  {/* Gancho */}
                  <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed italic">
                      "{post.gancho}"
                    </p>
                  </div>

                  {/* CTA */}
                  <motion.button
                    onClick={handleWhatsApp}
                    className="mt-2 w-full py-2 px-4 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#4c01f9] to-[#0A66C2] text-white hover:shadow-md hover:shadow-indigo-500/25 transition-shadow cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {post.cta} →
                  </motion.button>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-3">
            <button
              onClick={goPrev}
              className="w-8 h-8 rounded-full bg-gray-200/80 dark:bg-gray-700/80 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              aria-label="Anterior"
            >
              <span className="text-sm text-gray-600 dark:text-gray-300">◀</span>
            </button>
            <span className="text-sm text-gray-400 dark:text-gray-500 font-medium tabular-nums">
              {post.day}/{total}
            </span>
            <button
              onClick={goNext}
              className="w-8 h-8 rounded-full bg-gray-200/80 dark:bg-gray-700/80 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              aria-label="Siguiente"
            >
              <span className="text-sm text-gray-600 dark:text-gray-300">▶</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Sidebar desktop (>= 1440px) - Versión colapsada */}
    <AnimatePresence mode="wait">
      {isCollapsed ? (
        <motion.button
          key="collapsed"
          className="linkedin-sidebar-collapsed"
          onClick={() => setIsCollapsed(false)}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          aria-label="Expandir LinkedIn 30 Días"
        >
          <div className="w-8 h-8 rounded-lg bg-[#0A66C2] flex items-center justify-center">
            <span className="text-white text-xs font-bold">in</span>
          </div>
          <span className="linkedin-collapsed-badge">{post.day}</span>
        </motion.button>
      ) : (
        <motion.aside
          key="expanded"
          className="linkedin-sidebar"
          onMouseEnter={() => setIsPlaying(false)}
          onMouseLeave={() => setIsPlaying(true)}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Botón colapsar */}
          <button
            onClick={() => setIsCollapsed(true)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-200/80 dark:bg-gray-700/80 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer z-10"
            aria-label="Minimizar"
          >
            <span className="text-gray-500 dark:text-gray-400 text-xs">✕</span>
          </button>

          {/* Header */}
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-5 h-5 rounded bg-[#0A66C2] flex items-center justify-center">
              <span className="text-white text-[9px] font-bold">in</span>
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">
              30 Días
            </span>
          </div>

          {/* Card */}
          <div className="relative overflow-hidden rounded-xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-md border border-gray-200/60 dark:border-gray-700/60 shadow-lg">
            {/* Timer bar */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`timer-${currentIndex}`}
                className="h-[3px] bg-gradient-to-r from-[#0A66C2] to-[#4c01f9]"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: INTERVAL_MS / 1000, ease: 'linear' }}
              />
            </AnimatePresence>

            <div className="p-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="flex flex-col gap-2"
                >
                  {/* Day badge */}
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4c01f9] to-[#0A66C2] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                      {post.day}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                      Día {post.day} de {total}
                    </span>
                  </div>

                  {/* Problema */}
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-red-500/80 dark:text-red-400/80 font-bold mb-0.5">
                      Problema
                    </p>
                    <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                      {post.problema}
                    </p>
                  </div>

                  {/* Solución */}
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 font-bold mb-0.5">
                      Solución
                    </p>
                    <p className="text-[12px] text-gray-600 dark:text-gray-300 leading-snug">
                      {post.propuesta}
                    </p>
                  </div>

                  {/* Gancho */}
                  <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed italic">
                      "{post.gancho}"
                    </p>
                  </div>

                  {/* CTA */}
                  <motion.button
                    onClick={handleWhatsApp}
                    className="mt-1 w-full py-1.5 px-3 text-[11px] font-semibold rounded-lg bg-gradient-to-r from-[#4c01f9] to-[#0A66C2] text-white hover:shadow-md hover:shadow-indigo-500/25 transition-shadow cursor-pointer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {post.cta} →
                  </motion.button>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              onClick={goPrev}
              className="w-6 h-6 rounded-full bg-gray-200/80 dark:bg-gray-700/80 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              aria-label="Anterior"
            >
              <span className="text-[10px] text-gray-600 dark:text-gray-300">◀</span>
            </button>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium tabular-nums">
              {post.day}/{total}
            </span>
            <button
              onClick={goNext}
              className="w-6 h-6 rounded-full bg-gray-200/80 dark:bg-gray-700/80 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              aria-label="Siguiente"
            >
              <span className="text-[10px] text-gray-600 dark:text-gray-300">▶</span>
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
    </>
  );
}
