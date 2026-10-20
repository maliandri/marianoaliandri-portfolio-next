'use client';

import AuthGate from '@/components/auth/AuthGate';
import CatalogoProveedor from '@/components/proveedor/CatalogoProveedor';

export default function ComprasMoodfitPage() {
  return (
    <AuthGate title="Compras Mood Fit" subtitle="Sección privada. Entrá con tu cuenta de Google.">
      <CatalogoProveedor />
    </AuthGate>
  );
}
