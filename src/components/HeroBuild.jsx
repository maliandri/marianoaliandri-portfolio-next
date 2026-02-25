'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudinaryAvatar } from './CloudinaryImage';

// Líneas de código con metadata de timing y elementos UI que disparan
const CODE_LINES = [
  { id: 0,  tokens: [{ t: "import", c: "text-purple-400 font-semibold" }, { t: " React ", c: "text-gray-200" }, { t: "from", c: "text-purple-400 font-semibold" }, { t: " 'react'", c: "text-orange-300" }] },
  { id: 1,  tokens: [{ t: "import", c: "text-purple-400 font-semibold" }, { t: " { motion } ", c: "text-gray-200" }, { t: "from", c: "text-purple-400 font-semibold" }, { t: " 'framer-motion'", c: "text-orange-300" }] },
  { id: 2,  tokens: [{ t: "", c: "" }] }, // blank line
  { id: 3,  tokens: [{ t: "// Portfolio de Mariano Aliandri", c: "text-gray-500 italic" }] },
  { id: 4,  tokens: [{ t: "function", c: "text-purple-400 font-semibold" }, { t: " Portfolio", c: "text-yellow-300" }, { t: "() {", c: "text-gray-200" }], trigger: 'section' },
  { id: 5,  tokens: [{ t: "  return", c: "text-purple-400 font-semibold" }, { t: " (", c: "text-gray-200" }] },
  { id: 6,  tokens: [{ t: "    <", c: "text-blue-400" }, { t: "section", c: "text-green-400" }, { t: " className=", c: "text-sky-300" }, { t: '"hero"', c: "text-orange-300" }, { t: ">", c: "text-blue-400" }] },
  { id: 7,  tokens: [{ t: "      <", c: "text-blue-400" }, { t: "Avatar", c: "text-yellow-300" }], trigger: 'avatar' },
  { id: 8,  tokens: [{ t: "        src=", c: "text-sky-300" }, { t: '"mariano.jpg"', c: "text-orange-300" }] },
  { id: 9,  tokens: [{ t: "        size=", c: "text-sky-300" }, { t: "{160}", c: "text-sky-200" }] },
  { id: 10, tokens: [{ t: "      />", c: "text-blue-400" }] },
  { id: 11, tokens: [{ t: "      <", c: "text-blue-400" }, { t: "h1", c: "text-green-400" }, { t: ">", c: "text-blue-400" }], trigger: 'name' },
  { id: 12, tokens: [{ t: "        Mariano Aliandri", c: "text-gray-100 font-medium" }] },
  { id: 13, tokens: [{ t: "      </", c: "text-blue-400" }, { t: "h1", c: "text-green-400" }, { t: ">", c: "text-blue-400" }] },
  { id: 14, tokens: [{ t: "      <", c: "text-blue-400" }, { t: "p", c: "text-green-400" }, { t: " className=", c: "text-sky-300" }, { t: '"role"', c: "text-orange-300" }, { t: ">", c: "text-blue-400" }], trigger: 'role' },
  { id: 15, tokens: [{ t: "        Dev Full Stack &", c: "text-gray-200" }] },
  { id: 16, tokens: [{ t: "        Analista de Datos", c: "text-gray-200" }] },
  { id: 17, tokens: [{ t: "      </", c: "text-blue-400" }, { t: "p", c: "text-green-400" }, { t: ">", c: "text-blue-400" }] },
  { id: 18, tokens: [{ t: "      <", c: "text-blue-400" }, { t: "Stack", c: "text-yellow-300" }, { t: " items=", c: "text-sky-300" }, { t: '{skills}', c: "text-sky-200" }, { t: " />", c: "text-blue-400" }], trigger: 'skills' },
  { id: 19, tokens: [{ t: "      <", c: "text-blue-400" }, { t: "Button", c: "text-yellow-300" }, { t: " onClick=", c: "text-sky-300" }, { t: '{contact}', c: "text-sky-200" }, { t: ">", c: "text-blue-400" }], trigger: 'cta' },
  { id: 20, tokens: [{ t: "        Contactar", c: "text-gray-200" }] },
  { id: 21, tokens: [{ t: "      </", c: "text-blue-400" }, { t: "Button", c: "text-yellow-300" }, { t: ">", c: "text-blue-400" }] },
  { id: 22, tokens: [{ t: "    </", c: "text-blue-400" }, { t: "section", c: "text-green-400" }, { t: ">", c: "text-blue-400" }] },
  { id: 23, tokens: [{ t: "  )", c: "text-gray-200" }] },
  { id: 24, tokens: [{ t: "}", c: "text-gray-200" }] },
];

const SKILLS = ['React', 'Next.js', 'Python', 'Power BI', 'Firebase', 'TypeScript'];
const LINE_DELAY = 180; // ms entre líneas

export default function HeroBuild() {
  const [visibleLines, setVisibleLines] = useState([]);
  const [triggered, setTriggered] = useState(new Set());
  const [cursorLine, setCursorLine] = useState(-1);
  const [looping, setLooping] = useState(false);

  useEffect(() => {
    let timers = [];

    const runAnimation = () => {
      setVisibleLines([]);
      setTriggered(new Set());
      setCursorLine(-1);

      CODE_LINES.forEach((line, index) => {
        const t1 = setTimeout(() => {
          setCursorLine(index);
          setVisibleLines(prev => [...prev, line.id]);
          if (line.trigger) {
            setTriggered(prev => new Set([...prev, line.trigger]));
          }
        }, index * LINE_DELAY + 300);
        timers.push(t1);
      });

      // Loop animation
      const loopTimer = setTimeout(() => {
        setLooping(true);
        setTimeout(() => {
          setLooping(false);
          runAnimation();
        }, 1200);
      }, CODE_LINES.length * LINE_DELAY + 3000);
      timers.push(loopTimer);
    };

    runAnimation();
    return () => timers.forEach(clearTimeout);
  }, []);

  const show = (key) => triggered.has(key);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-gray-950 border border-gray-800 shadow-2xl">
      {/* Scanline overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 opacity-[0.03]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)' }}
      />

      <div className="flex flex-col lg:flex-row min-h-[580px]">

        {/* ── PANEL IZQUIERDO: Editor de código ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <div className="ml-3 flex gap-1">
              <span className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded-t border-t border-x border-gray-700 font-mono">Portfolio.jsx</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-green-400 font-mono animate-pulse">● LIVE</span>
            </div>
          </div>

          {/* Code area */}
          <div className="flex-1 overflow-hidden font-mono text-sm p-4 relative">
            {/* Glow effect */}
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-purple-900/10 to-transparent pointer-events-none" />

            <AnimatePresence mode="popLayout">
              {looping && (
                <motion.div
                  key="fade"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gray-950 z-20 flex items-center justify-center"
                >
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="text-purple-400 font-mono text-sm"
                  >
                    rebuilding...
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-[2px]">
              {CODE_LINES.map((line, index) => (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={visibleLines.includes(line.id) ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                  transition={{ duration: 0.12 }}
                  className={`flex items-center gap-3 px-1 rounded ${cursorLine === index ? 'bg-white/5' : ''}`}
                >
                  {/* Line number */}
                  <span className="w-6 text-right text-gray-600 text-xs select-none shrink-0">
                    {index + 1}
                  </span>

                  {/* Code tokens */}
                  <span className="flex flex-wrap gap-0 leading-relaxed">
                    {line.tokens.map((token, ti) => (
                      <span key={ti} className={token.c}>{token.t}</span>
                    ))}
                    {/* Blinking cursor on current line */}
                    {cursorLine === index && (
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ repeat: Infinity, duration: 0.6 }}
                        className="inline-block w-[2px] h-[1em] bg-purple-400 ml-[1px] align-middle"
                      />
                    )}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Divisor vertical */}
        <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-purple-700/40 to-transparent shrink-0" />

        {/* ── PANEL DERECHO: UI que se construye ── */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-5 relative overflow-hidden">
          {/* Background grid */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
          />

          {/* Preview label */}
          <div className="absolute top-3 right-4 text-xs text-gray-600 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            preview
          </div>

          {/* Avatar */}
          <AnimatePresence>
            {show('avatar') && (
              <motion.div
                key="avatar"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-purple-500 shadow-[0_0_30px_rgba(139,92,246,0.4)] shrink-0"
              >
                <CloudinaryAvatar
                  publicId="image_12a02c"
                  alt="Mariano Aliandri"
                  size={112}
                  className="w-full h-full object-cover"
                />
                {/* Build overlay que desaparece */}
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="absolute inset-0 bg-purple-900/60 flex items-center justify-center"
                >
                  <span className="text-white text-xs font-mono">loading...</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name */}
          <AnimatePresence>
            {show('name') && (
              <motion.div
                key="name"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                  Mariano Aliandri
                </h1>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Role */}
          <AnimatePresence>
            {show('role') && (
              <motion.div
                key="role"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center -mt-2"
              >
                <p className="text-purple-400 font-medium text-sm md:text-base">
                  Dev Full Stack & Analista de Datos
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skills */}
          <AnimatePresence>
            {show('skills') && (
              <motion.div
                key="skills"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-wrap gap-2 justify-center max-w-xs"
              >
                {SKILLS.map((skill, i) => (
                  <motion.span
                    key={skill}
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.07, type: 'spring', stiffness: 300, damping: 22 }}
                    className="px-2.5 py-1 rounded-full bg-gray-800 border border-purple-800/60 text-purple-300 text-xs font-mono"
                  >
                    {skill}
                  </motion.span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* CTA Button */}
          <AnimatePresence>
            {show('cta') && (
              <motion.div
                key="cta"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 240, damping: 18 }}
                className="flex gap-3 mt-1"
              >
                <a
                  href="https://wa.me/+542995414422"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-full text-sm shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-all duration-200 hover:shadow-[0_0_30px_rgba(139,92,246,0.5)]"
                >
                  Contactar
                </a>
                <a
                  href="#contact"
                  className="px-6 py-2.5 border border-purple-700 text-purple-300 hover:bg-purple-900/40 rounded-full text-sm transition-all duration-200"
                >
                  Ver más
                </a>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Placeholder cuando nada está visible aún */}
          {!show('avatar') && (
            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="text-gray-700 text-sm font-mono text-center"
            >
              {'<'} esperando código... {'>'}
            </motion.div>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-900/80 border-t border-gray-800 text-xs font-mono text-gray-500">
        <div className="flex items-center gap-3">
          <span className="text-purple-400">JSX</span>
          <span>UTF-8</span>
          <span>Next.js 15</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-green-400">✓ No errors</span>
          <span>Ln {cursorLine + 1}, Col 1</span>
        </div>
      </div>
    </div>
  );
}
