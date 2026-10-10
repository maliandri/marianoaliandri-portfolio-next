'use client';

import { usePathname, useRouter } from 'next/navigation';
import AppShell from './shell/AppShell';
import { useAuthUser } from '@/hooks/useAuthUser';
import { firebaseAuth } from '@/utils/firebaseservice';

// Envuelve mi-cuenta, mis-compras, perfil y lead-finder-pro/buscar con el mismo esqueleto
// que /admin (AppShell, variante cliente). El chrome público (Navbar/Footer/WhatsApp) se
// oculta aparte, en providers.jsx (isClientArea).
// Sin usuario logueado se deja que el AuthGate de cada página muestre su propio login.
const SECTIONS = [
  { id: 'cuenta', label: 'Mi cuenta', items: [
    { id: 'mi-cuenta',   label: 'Resumen',     href: '/mi-cuenta' },
    { id: 'mis-compras', label: 'Mis compras', href: '/mis-compras' },
    { id: 'perfil',      label: 'Mi perfil',   href: '/perfil' },
  ]},
  { id: 'lfp', label: 'Lead Finder Pro', items: [
    { id: 'buscar', label: 'Buscar negocios', href: '/lead-finder-pro/buscar' },
    { id: 'demo',   label: 'Demo gratis',     href: '/lead-finder-pro/demo' },
  ]},
  { id: 'analitica', label: 'Analítica', items: [
    { id: 'rubros-buscados', label: 'Rubros buscados',    href: '/analitica' },
    { id: 'analitica-zonal', label: 'Analítica regional', href: '/analitica?tab=zona' },
  ]},
];

function locate(pathname) {
  for (const s of SECTIONS) {
    const item = s.items.find(it => {
      const base = it.href.split('?')[0];
      return pathname === base || pathname.startsWith(`${base}/`);
    });
    if (item) return { sectionId: s.id, itemId: item.id };
  }
  return { sectionId: SECTIONS[0].id, itemId: null };
}

export default function ClientAreaShell({ children }) {
  const { user, loading } = useAuthUser();
  const rawPathname = usePathname();
  const pathname = rawPathname.replace(/\/$/, '') || '/';
  const router = useRouter();

  if (loading || !user) return children;

  const handleLogout = async () => {
    await firebaseAuth.logout();
    router.push('/');
  };

  const name = user.displayName || 'Tu cuenta';
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const { sectionId, itemId } = locate(pathname);

  return (
    <AppShell
      variant="client"
      forceDark
      brand={{ logo: initials.charAt(0) || 'M', title: name, subtitle: 'Tu cuenta' }}
      sections={SECTIONS}
      activeSectionId={sectionId}
      activeItemId={itemId}
      footer={{
        initials,
        name,
        detail: user.email,
        actions: [{ id: 'logout', label: 'Cerrar sesión', icon: 'logout', onClick: handleLogout, danger: true }],
      }}
    >
      {children}
    </AppShell>
  );
}
