'use client';

import Link from 'next/link';
import AuthGate from '@/components/auth/AuthGate';
import LeadFinder from '@/components/leadfinder/LeadFinder';
import LanguageSwitch from '@/components/leadfinderpro/LanguageSwitch';
import ClientAreaShell from '@/components/ClientAreaShell';

export default function LeadFinderProBuscarPage() {
  return (
    <ClientAreaShell>
      <main className="min-h-screen bg-[#0a0a0a] pt-10 pb-20">
        <div className="max-w-6xl mx-auto px-4 mb-6">
          <div className="flex items-center justify-between">
            <Link href="/lead-finder-pro" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              ← Lead Finder Pro
            </Link>
            <LanguageSwitch />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white mt-2">Buscar negocios</h1>
          <p className="text-gray-500 text-sm mt-1">Elegí cuántos leads querés. Pagás solo por los que te entregamos: los negocios sin web ni WhatsApp no se cobran.</p>
        </div>

        <div className="max-w-6xl mx-auto px-4">
          <AuthGate
            title="Buscar negocios"
            subtitle="Registrate gratis para acceder a la herramienta."
          >
            <LeadFinder variant="cliente" lang="es" forceDark />
          </AuthGate>
        </div>
      </main>
    </ClientAreaShell>
  );
}
