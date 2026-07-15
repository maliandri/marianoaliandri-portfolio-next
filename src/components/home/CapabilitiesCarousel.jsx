'use client';

import { useState, useEffect, useRef } from 'react';
import { CAPABILITIES } from '@/data/capabilities';

const AUTO_MS = 4500;

export default function CapabilitiesCarousel() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = CAPABILITIES.length;

  const go = (i) => setIndex((i + n) % n);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex(i => (i + 1) % n), AUTO_MS);
    return () => clearInterval(t);
  }, [paused, n]);

  // Swipe táctil
  const touchX = useRef(null);
  const onTouchStart = e => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    touchX.current = null;
  };

  return (
    <section className="max-w-4xl mx-auto px-4 py-16">
      <div className="text-center mb-8">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">Lo que puedo construir</span>
        <h2 className="text-3xl md:text-4xl font-bold text-white">
          Todo lo que tu negocio puede tener online
        </h2>
        <p className="text-gray-400 mt-2 text-sm md:text-base">
          Desde una tienda hasta automatizaciones — armado con tecnología moderna.
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Track */}
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {CAPABILITIES.map(cap => (
            <div key={cap.id} className="shrink-0 basis-full p-8 md:p-12">
              <div className="flex flex-col items-center text-center">
                <div className="text-5xl md:text-6xl mb-4" aria-hidden>{cap.emoji}</div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">{cap.title}</h3>
                <p className="text-gray-300 max-w-md">{cap.desc}</p>
                <p className="text-indigo-300 font-medium mt-3 max-w-md">✓ {cap.benefit}</p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-5">
                  {cap.techs.map(t => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Flechas */}
        <button onClick={() => go(index - 1)} aria-label="Anterior"
          className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-colors">‹</button>
        <button onClick={() => go(index + 1)} aria-label="Siguiente"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center transition-colors">›</button>
      </div>

      {/* Dots */}
      <div className="flex justify-center flex-wrap gap-2 mt-5">
        {CAPABILITIES.map((cap, i) => (
          <button key={cap.id} onClick={() => go(i)} aria-label={cap.title}
            className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-indigo-400' : 'w-2 bg-white/25 hover:bg-white/40'}`} />
        ))}
      </div>

      {/* CTA */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
        <a href="/presupuesto"
          className="w-full sm:w-auto text-center px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors">
          Pedir presupuesto
        </a>
        <a href={'https://wa.me/5492995414422?text=' + encodeURIComponent('Hola Mariano! Quiero mejorar la presencia digital de mi negocio.')}
          target="_blank" rel="noopener noreferrer"
          className="w-full sm:w-auto text-center px-6 py-3 border border-green-500 text-green-400 rounded-xl font-medium hover:bg-green-500/10 transition-colors">
          💬 Hablar por WhatsApp
        </a>
      </div>
    </section>
  );
}
