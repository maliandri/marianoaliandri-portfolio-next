'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppSidebar from './AppSidebar';
import { useAuthUser } from '@/hooks/useAuthUser';
import { firebaseAuth } from '@/utils/firebaseservice';

// Envuelve las páginas de la Sección 1 de la spec (mi-cuenta, mis-compras, perfil,
// lead-finder-pro/buscar, analitica) con el mismo sidebar que usa /admin (AppSidebar),
// para que se sientan un "sitio interno" del cliente en vez de una página más del sitio
// público. El chrome público (Navbar/Footer/WhatsApp) se oculta aparte, en
// providers.jsx (isClientArea), no acá.
//
// Sin usuario logueado no tiene sentido mostrar el sidebar (no hay a dónde navegar
// todavía) -- se deja que el AuthGate de cada página (dentro de children) muestre su
// propio prompt de login a pantalla completa.
const ITEMS = [
  { id: 'mi-cuenta',        label: 'Mi cuenta',          icon: '🏠', href: '/mi-cuenta' },
  { id: 'mis-compras',      label: 'Mis compras',         icon: '🧾', href: '/mis-compras' },
  { id: 'lead-finder-pro',  label: 'Lead Finder Pro',     icon: '🎯', href: '/lead-finder-pro/buscar' },
  { id: 'rubros-buscados',  label: 'Rubros buscados',     icon: '🔍', href: '/analitica' },
  { id: 'analitica-zonal',  label: 'Analítica regional',  icon: '🗺️', href: '/analitica?tab=zona' },
  { id: 'perfil',           label: 'Mi perfil',           icon: '⚙️', href: '/perfil' },
];

function activeIdFor(pathname) {
  // Prioridad: coincidencia exacta primero, luego prefijo
  const found = ITEMS.find(it => {
    const base = it.href.split('?')[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  });
  return found?.id || null;
}

export default function ClientAreaShell({ children }) {
  const { user, loading } = useAuthUser();
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/\/$/, '') || '/';
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  if (loading || !user) return children;

  const handleLogout = async () => {
    await firebaseAuth.logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] md:flex">
      <AppSidebar
        sections={[{ id: 'cliente', items: ITEMS }]}
        activeId={activeIdFor(pathname)}
        navOpen={navOpen}
        onNavOpenChange={setNavOpen}
        storageKey="client_sidebar_collapsed"
        headerTitle={user.displayName || 'Tu cuenta'}
        headerSubtitle={user.email}
        footer={
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 min-h-[34px] rounded-lg text-[13px] text-left text-red-500 hover:bg-red-500/10 transition-colors font-medium"
          >
            <span className="shrink-0 flex">🚪</span>
            <span className="truncate">Cerrar sesión</span>
          </button>
        }
      />

      <div className="flex-1 min-w-0">
        <button
          onClick={() => setNavOpen(v => !v)}
          aria-label="Menú"
          className="md:hidden flex flex-col gap-[3px] p-3 m-2 text-gray-300"
        >
          <span className={`block h-0.5 w-5 bg-current transition-transform ${navOpen ? 'translate-y-[5px] rotate-45' : ''}`} />
          <span className={`block h-0.5 w-5 bg-current transition-opacity ${navOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-5 bg-current transition-transform ${navOpen ? '-translate-y-[5px] -rotate-45' : ''}`} />
        </button>
        {children}
      </div>
    </div>
  );
}
