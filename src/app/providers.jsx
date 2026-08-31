'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { queryClient } from '@/utils/queryClient';
import { CartProvider } from '@/context/CartContext';

// UI Components (critical - load immediately)
import ThemeToggle from '@/components/ui/ThemeToggle';
import Footer from '@/components/ui/Footer';
import WhatsAppButton from '@/components/ui/WhatsAppButton';

// Firebase-dependent components — deferred to keep Firebase out of the critical render path
const AIChatBot   = dynamic(() => import('@/components/social/AIChatBot'),   { ssr: false, loading: () => null });
const AuthButton  = dynamic(() => import('@/components/auth/AuthButton'),  { ssr: false, loading: () => null });

// Tools: ssr:false evita que se pre-rendericen en servidor (usan window/browser APIs)
const KpiRadar = dynamic(() => import('@/components/tools/KpiRadar'), { ssr: false });
const DashboardStats = dynamic(() => import('@/components/tools/DashboardStats'), { ssr: false });
const CVATSUploader = dynamic(() => import('@/components/tools/CVATSUploader'), { ssr: false });
const RadarWeb = dynamic(() => import('@/components/tools/RadarWeb'), { ssr: false });
const LabsTool = dynamic(() => import('@/components/tools/LabsTool'), { ssr: false });

const TOOL_PATHS = ['/stats', '/ats', '/kpi', '/radarweb', '/labs', '/lead-finder-pro'];
const NAV_LINKS = [
  { label: 'Proyectos',   href: '/#proyectos' },
  { label: 'Contacto',    href: '/#contact' },
  { label: 'Auditorías',  href: '/auditorias' },
  { label: 'Analítica',   href: '/analitica' },
  { label: 'Tienda',      href: '/tienda' },
  { label: 'Presupuesto', href: '/presupuesto' },
];
const TOOLS = [
  { label: 'Lead Finder Pro', href: '/lead-finder-pro', icon: '🎯', desc: 'Para devs: encontrá negocios sin sitio o con SEO débil' },
  { label: 'Análisis de CV', href: '/ats',     icon: '📄', desc: 'Analizá tu CV contra ofertas con IA' },
  { label: 'Radar Web',      href: '/radarweb', icon: '📊', desc: 'Analizá la presencia digital de un sitio' },
  { label: 'Labs',           href: '/labs',     icon: '🧪', desc: 'Experimentos y herramientas en desarrollo' },
  { label: 'FAQ',            href: '/faq',      icon: '❓', desc: '¿Cuánto cuesta? ¿Cuánto tarda? Todo acá' },
];

const SCRAMBLE_POOL = 'abcdefghijklmnopqrstuvwxyz0123456789@#$_-+';
const LOGO_TEXT     = 'marianoaliandri';
const LOGO_SUFFIX   = '.com.ar';

function ScrambleLogo({ onClick }) {
  const [chars, setChars] = useState(LOGO_TEXT.split(''));
  const timer = useRef(null);

  const run = useCallback(() => {
    clearTimeout(timer.current);
    let frame = 0;
    const total = LOGO_TEXT.length * 3 + 8;

    const tick = () => {
      const locked = Math.floor(frame / 3);
      setChars(
        LOGO_TEXT.split('').map((ch, i) =>
          i < locked ? ch : SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)]
        )
      );
      frame++;
      if (frame < total) {
        timer.current = setTimeout(tick, 38);
      } else {
        setChars(LOGO_TEXT.split(''));
      }
    };

    tick();
  }, []);

  useEffect(() => {
    // Pequeño retraso al montar para que se vea el efecto en la carga
    timer.current = setTimeout(run, 120);
    return () => clearTimeout(timer.current);
  }, [run]);

  return (
    <Link
      href="/"
      onClick={onClick}
      onMouseEnter={run}
      className="shrink-0 select-none"
      aria-label="marianoaliandri.com.ar — inicio"
    >
      <span className="font-mono font-bold text-base tracking-tight text-white">
        {chars.join('')}
      </span>
      <span className="font-mono font-bold text-base tracking-tight text-indigo-400">
        {LOGO_SUFFIX}
      </span>
    </Link>
  );
}

function ToolsDropdown({ pathname }) {
  const [open, setOpen] = useState(false);
  const isActive = TOOL_PATHS.some(p => pathname === p);

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive ? 'text-indigo-400 bg-indigo-600/10' : 'text-gray-400 hover:text-white hover:bg-white/5'
        }`}
      >
        Herramientas
        <svg className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
          <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden w-64">
            <div className="px-4 pt-3 pb-1">
              <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">Herramientas gratuitas</p>
            </div>
            {TOOLS.map(t => (
              <Link
                key={t.href}
                href={t.href}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors group ${
                  pathname === t.href ? 'bg-indigo-600/10' : ''
                }`}
              >
                <span className="text-lg mt-0.5">{t.icon}</span>
                <div>
                  <p className={`text-sm font-medium ${pathname === t.href ? 'text-indigo-400' : 'text-white'}`}>{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Navbar({ pathname }) {
  const [open, setOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/8">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">

        {/* Logo */}
        <ScrambleLogo onClick={() => setOpen(false)} />

        {/* Nav links — desktop */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                (pathname === href || (href !== '/' && pathname.startsWith(href) && href !== '/#proyectos' && href !== '/#contact'))
                  ? 'text-indigo-400 bg-indigo-600/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          ))}
          <ToolsDropdown pathname={pathname} />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden md:block">
            <AuthButton />
          </div>
          <AIChatBot />
          {/* Hamburger — mobile */}
          <button
            onClick={() => setOpen(p => !p)}
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Menú"
          >
            <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/8 bg-[#0a0a0a] px-5 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              {label}
            </Link>
          ))}
          {/* Herramientas — mobile */}
          <button
            onClick={() => setToolsOpen(p => !p)}
            className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span>Herramientas</span>
            <svg className={`w-4 h-4 transition-transform ${toolsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {toolsOpen && TOOLS.map(t => (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => { setOpen(false); setToolsOpen(false); }}
              className="flex items-center gap-3 px-6 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span>{t.icon}</span> {t.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-white/8 mt-1">
            <AuthButton />
          </div>
        </div>
      )}
    </nav>
  );
}

// Oculta el chrome cuando ?screenshot=1 (Microlink/OG). Aislado en su propio
// Suspense para que useSearchParams NO haga suspender a toda la página en SSR.
function ScreenshotHider() {
  const searchParams = useSearchParams();
  if (searchParams.get('screenshot') !== '1') return null;
  return <style dangerouslySetInnerHTML={{ __html: '.app-chrome{display:none!important}' }} />;
}

function AppChromeInner({ children }) {
  const rawPathname = usePathname();
  const router = useRouter();

  // Normalize: remove trailing slash for matching (trailingSlash:true adds it)
  const pathname = rawPathname.replace(/\/$/, '') || '/';

  // /admin tiene su propio header, sidebar y hamburger — el chrome del sitio
  // público (Navbar fijo z-1000) lo tapaba por completo en mobile.
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');

  const closeTool = () => router.push('/');

  return (
    <div className="App font-sans min-h-screen text-gray-800 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-500 relative overflow-x-hidden">

      <Suspense fallback={null}><ScreenshotHider /></Suspense>

      {!isAdmin && <div className="app-chrome"><Navbar pathname={pathname} /></div>}

      {/* Tool modals - lazy loaded */}
      <Suspense fallback={null}>
        {pathname === '/stats' && <DashboardStats isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/ats' && <CVATSUploader isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/kpi' && <KpiRadar isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/radarweb' && <RadarWeb isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/labs' && <LabsTool isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
      </Suspense>

      {/* Page content */}
      {children}

      {!isAdmin && <div className="app-chrome"><Footer /></div>}
      {!isAdmin && <div className="app-chrome"><WhatsAppButton /></div>}
    </div>
  );
}

// Sin Suspense que renderice {children} como fallback: eso duplicaba el
// contenido (2 H1) y dejaba el chrome fuera del HTML en SSR (páginas huérfanas).
function AppChrome({ children }) {
  return <AppChromeInner>{children}</AppChromeInner>;
}

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <AppChrome>{children}</AppChrome>
      </CartProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
