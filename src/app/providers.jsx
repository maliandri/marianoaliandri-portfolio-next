'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { CartProvider } from '@/context/CartContext';
import { queryClient } from '@/utils/queryClient';

// UI Components (critical - load immediately)
import ThemeToggle from '@/components/ThemeToggle';
import ShopButton from '@/components/ShopButton';
import Footer from '@/components/Footer';
import WhatsAppButton from '@/components/WhatsAppButton';

// Firebase-dependent components — deferred to keep Firebase out of the critical render path
const AuthButton = dynamic(() => import('@/components/AuthButton'), { ssr: false, loading: () => <div className="w-24 h-8 bg-gray-100 dark:bg-gray-800 rounded-full" /> });
const LikeSystem = dynamic(() => import('@/components/LikeSystem'), { ssr: false, loading: () => null });
const VisitorCounter = dynamic(() => import('@/components/VisitorCounter'), { ssr: false, loading: () => null });
const AIChatBot = dynamic(() => import('@/components/AIChatBot'), { ssr: false, loading: () => null });
const LinkedInSidebar = dynamic(() => import('@/components/LinkedInSidebar'), { ssr: false, loading: () => null });

// Tools: ssr:false evita que se pre-rendericen en servidor (usan window/browser APIs)
const KpiRadar = dynamic(() => import('@/components/KpiRadar'), { ssr: false });
const DashboardStats = dynamic(() => import('@/components/DashboardStats'), { ssr: false });
const CVATSUploader = dynamic(() => import('@/components/CVATSUploader'), { ssr: false });
const ROICalculator = dynamic(() => import('@/components/Calculadora'), { ssr: false });
const WebCalculator = dynamic(() => import('@/components/CalculadoraWeb'), { ssr: false });
const RadarWeb = dynamic(() => import('@/components/RadarWeb'), { ssr: false });

const TOOL_PATHS = ['/web', '/roi', '/stats', '/ats', '/kpi', '/radarweb'];

function AppChrome({ children }) {
  const rawPathname = usePathname();
  const router = useRouter();

  // Normalize: remove trailing slash for matching (trailingSlash:true adds it)
  const pathname = rawPathname.replace(/\/$/, '') || '/';

  const isToolPage = TOOL_PATHS.includes(pathname);
  const showFloatingButtons = pathname === '/' || isToolPage;

  const openTool = (toolId) => router.push(`/${toolId}`);
  const closeTool = () => router.push('/');

  return (
    <div className="App font-sans min-h-screen text-gray-800 bg-gray-50 dark:bg-gray-900 dark:text-gray-100 transition-colors duration-500 relative overflow-x-hidden">

      {/* Fixed top bar */}
      <div className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-center py-3 px-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center max-w-full">
          <ShopButton />
          <AuthButton />
          <AIChatBot />
          <LikeSystem />
          <VisitorCounter />
          <ThemeToggle />
        </div>
      </div>

      {/* Tool modals - lazy loaded */}
      <Suspense fallback={null}>
        {pathname === '/stats' && <DashboardStats isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/ats' && <CVATSUploader isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/roi' && <ROICalculator isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/web' && <WebCalculator isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/kpi' && <KpiRadar isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
        {pathname === '/radarweb' && <RadarWeb isOpen={true} onClose={closeTool} hideFloatingButton={true} />}
      </Suspense>

      {/* Page content */}
      {children}

      {/* Floating tool buttons - visible on home and tool pages */}
      {showFloatingButtons && (
        <div className="floating-buttons-container">
          <button className="floating-button" onClick={() => openTool('web')} title="Cotizar Web">
            <span className="button-icon">🌐</span>
            <span className="button-label">Cotizar Web</span>
          </button>
          <button className="floating-button" onClick={() => openTool('radarweb')} title="Radar Web">
            <span className="button-icon">🔍</span>
            <span className="button-label">Radar Web</span>
          </button>
          <button className="floating-button" onClick={() => openTool('roi')} title="Calcular ROI">
            <span className="button-icon">💰</span>
            <span className="button-label">Calcular ROI</span>
          </button>
          <button className="floating-button" onClick={() => openTool('kpi')} title="Radar KPI">
            <span className="button-icon">🎯</span>
            <span className="button-label">Radar KPI</span>
          </button>
          <button className="floating-button" onClick={() => openTool('ats')} title="Analizador ATS">
            <span className="button-icon">📄</span>
            <span className="button-label">Analizador ATS</span>
          </button>
          <button className="floating-button" onClick={() => openTool('stats')} title="Estadísticas">
            <span className="button-icon">📊</span>
            <span className="button-label">Estadísticas</span>
          </button>
        </div>
      )}

      <Footer />
      <LinkedInSidebar />
      <WhatsAppButton />
    </div>
  );
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
