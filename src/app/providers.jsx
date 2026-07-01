'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { queryClient } from '@/utils/queryClient';

// UI Components (critical - load immediately)
import ThemeToggle from '@/components/ThemeToggle';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';

// Firebase-dependent components — deferred to keep Firebase out of the critical render path
const AIChatBot = dynamic(() => import('@/components/AIChatBot'), { ssr: false, loading: () => null });

// Tools: ssr:false evita que se pre-rendericen en servidor (usan window/browser APIs)
const KpiRadar = dynamic(() => import('@/components/KpiRadar'), { ssr: false });
const DashboardStats = dynamic(() => import('@/components/DashboardStats'), { ssr: false });
const CVATSUploader = dynamic(() => import('@/components/CVATSUploader'), { ssr: false });
const ROICalculator = dynamic(() => import('@/components/Calculadora'), { ssr: false });
const WebCalculator = dynamic(() => import('@/components/CalculadoraWeb'), { ssr: false });
const RadarWeb = dynamic(() => import('@/components/RadarWeb'), { ssr: false });
const LabsTool = dynamic(() => import('@/components/LabsTool'), { ssr: false });

const TOOL_PATHS = ['/web', '/roi', '/stats', '/ats', '/kpi', '/radarweb', '/labs'];
const NAV_LINKS = [
  { label: 'Proyectos', href: '/#proyectos' },
  { label: 'Contacto',  href: '/#contact' },
  { label: 'Presupuesto', href: '/presupuesto' },
];

function Navbar({ pathname }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/8">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="text-white font-bold text-lg tracking-tight shrink-0" onClick={() => setOpen(false)}>
          Mariano<span className="text-indigo-400">.</span>
        </Link>

        {/* Nav links — desktop */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === '/presupuesto' && href === '/presupuesto'
                  ? 'text-indigo-400 bg-indigo-600/10'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
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
        </div>
      )}
    </nav>
  );
}

function AppChromeInner({ children }) {
  const rawPathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Normalize: remove trailing slash for matching (trailingSlash:true adds it)
  const pathname = rawPathname.replace(/\/$/, '') || '/';

  // ?screenshot=1 → renderizar solo el contenido, sin chrome (para Microlink / OG)
  const isScreenshot = searchParams.get('screenshot') === '1';

  const closeTool = () => router.push('/');

  if (isScreenshot) {
    return (
      <div className="App font-sans min-h-screen text-gray-800 bg-gray-50 dark:bg-gray-900 dark:text-gray-100">
        {children}
      </div>
    );
  }

  return (
    <div className="App font-sans min-h-screen text-gray-800 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-500 relative overflow-x-hidden">

      <Navbar pathname={pathname} />

      {/* Tool modals - lazy loaded */}
      <Suspense fallback={null}>
        {pathname === '/stats' && <DashboardStats isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/ats' && <CVATSUploader isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/roi' && <ROICalculator isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/web' && <WebCalculator isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/kpi' && <KpiRadar isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/radarweb' && <RadarWeb isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {/* Labs: modal — ?screenshot=1 no llega aquí (early return arriba) */}
        {pathname === '/labs' && <LabsTool isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
      </Suspense>

      {/* Page content */}
      {children}

      <Footer />
      <WhatsAppButton />
    </div>
  );
}

function AppChrome({ children }) {
  return (
    <Suspense fallback={
      <div className="App font-sans min-h-screen bg-gray-50 dark:bg-gray-900">{children}</div>
    }>
      <AppChromeInner>{children}</AppChromeInner>
    </Suspense>
  );
}

export function Providers({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppChrome>{children}</AppChrome>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
