'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import TelefonoChat from './TelefonoChat';

// Hero del home de IA como escena de scroll (referencia: latitudnomade.com, 2026-11-25). En escritorio la sección
// mide ~2,3 pantallas y su contenido queda fijo (sticky) mientras se baja: el texto sube y se apaga, el chat del
// costado se desvanece y en el centro aparece un iPhone con Claude y una conversación que se scrollea adentro.
// El layout lo decide el CSS (lg:), igual en el servidor y en el navegador: al hidratar no se mueve nada (sin CLS) y
// el h1 (LCP) se pinta quieto. Solo transform/opacity. En celular el iPhone va debajo del texto, sin escena.
export default function HeroEscena({ texto, demo }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const [escritorio, setEscritorio] = useState(false);
  const [telefonoActivo, setTelefonoActivo] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const f = () => setEscritorio(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const activa = escritorio && !reduce;

  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const textoOpacity = useTransform(p, [0, 0.35], [1, 0]);
  const textoY = useTransform(p, [0, 0.35], [0, -70]);
  const demoOpacity = useTransform(p, [0.05, 0.3], [1, 0]);
  const demoX = useTransform(p, [0.05, 0.3], ['0%', '-25%']);
  const telOpacity = useTransform(p, [0.22, 0.48], [0, 1]);
  const telScale = useTransform(p, [0.22, 0.55], [0.82, 1]);
  const telY = useTransform(p, [0.22, 0.55], [80, 0]);
  const pieOpacity = useTransform(p, [0.55, 0.75], [0, 1]);
  // El iPhone recibe toques/scroll recién cuando se ve (si no, taparía los botones del hero).
  useMotionValueEvent(p, 'change', (v) => setTelefonoActivo(v > 0.4));

  return (
    <section ref={ref} className={`relative px-6 ${reduce ? '' : 'lg:h-[230vh]'}`}>
      <div className={`flex items-center pt-24 md:pt-32 pb-20 overflow-x-clip ${reduce ? '' : 'lg:sticky lg:top-0 lg:h-[100dvh] lg:py-0'}`}>
        <div className="relative w-full max-w-6xl mx-auto grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-14 items-center">
          <motion.div className="hero-glow flex flex-col gap-6 min-w-0" style={activa ? { opacity: textoOpacity, y: textoY } : undefined}>
            {texto}
          </motion.div>
          <div className="min-w-0 flex justify-center">
            <motion.div className="hidden lg:block w-full" style={activa ? { opacity: demoOpacity, x: demoX } : undefined}>{demo}</motion.div>
            <TelefonoChat className="lg:hidden" />
          </div>
        </div>

        {/* iPhone en el centro (solo escritorio con escena) */}
        {activa && (
          <motion.div style={{ opacity: telOpacity, scale: telScale, y: telY }}
            className={`absolute inset-0 pt-16 flex flex-col items-center justify-center gap-5 ${telefonoActivo ? '' : 'pointer-events-none'}`}
            aria-hidden={!telefonoActivo}>
            <TelefonoChat />
            <motion.p style={{ opacity: pieOpacity }} className="text-center text-lg text-fg-300 max-w-md">
              Así le preguntás a tu negocio: <span className="text-fg font-semibold">desde el celular, con tus datos reales.</span>
              <span className="block text-sm text-fg-500 mt-1">Deslizá la conversación dentro del celular.</span>
            </motion.p>
          </motion.div>
        )}
      </div>
    </section>
  );
}
