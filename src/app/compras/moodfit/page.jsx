'use client';

import AuthGate from '@/components/auth/AuthGate';
import ClientAreaShell from '@/components/ClientAreaShell';
import CatalogoProveedor from '@/components/proveedor/CatalogoProveedor';

export default function ComprasMoodfitPage() {
  return (
    <ClientAreaShell>
      <AuthGate title="Compras Mood Fit" subtitle="Sección privada. Entrá con tu cuenta de Google.">
        <CatalogoProveedor />
      </AuthGate>
    </ClientAreaShell>
  );
}
