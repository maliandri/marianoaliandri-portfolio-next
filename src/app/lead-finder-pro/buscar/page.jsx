'use client';

import Link from 'next/link';
import AuthGate from '@/components/auth/AuthGate';
import CustomerLeadFinderPanel from '@/components/leadfinderpro/CustomerLeadFinderPanel';
import ClientNavShell from '@/components/leadfinderpro/ClientNavShell';

export default function LeadFinderProBuscarPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4 mb-6">
        <Link href="/lead-finder-pro" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Lead Finder Pro
        </Link>
        <h1 className="text-2xl md:text-3xl font-black text-white mt-2">Buscar negocios</h1>
        <p className="text-gray-500 text-sm mt-1">Buscar y explorar es gratis. Auditar a fondo gasta 1 crédito por negocio.</p>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <AuthGate
          title="Buscar negocios"
          subtitle="Registrate gratis para acceder a la herramienta."
        >
          <ClientNavShell />
          <CustomerLeadFinderPanel />
        </AuthGate>
      </div>
    </main>
  );
}
