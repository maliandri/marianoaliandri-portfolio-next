'use client';

import Link from 'next/link';
import AuthGate from '@/components/auth/AuthGate';
import CustomerLeadFinderPanel from '@/components/leadfinderpro/CustomerLeadFinderPanel';
import ClientNavShell from '@/components/leadfinderpro/ClientNavShell';
import LanguageSwitch from '@/components/leadfinderpro/LanguageSwitch';

export default function LeadFinderProBuscarPageEn() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4 mb-6">
        <div className="flex items-center justify-between">
          <Link href="/en/lead-finder-pro" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
            ← Lead Finder Pro
          </Link>
          <LanguageSwitch />
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-white mt-2">Search businesses</h1>
        <p className="text-gray-500 text-sm mt-1">Searching and exploring is free. A full audit uses 1 credit per business.</p>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <AuthGate
          title="Search businesses"
          subtitle="Sign up for free to access the tool."
          lang="en"
        >
          <ClientNavShell />
          <CustomerLeadFinderPanel lang="en" />
        </AuthGate>
      </div>
    </main>
  );
}
