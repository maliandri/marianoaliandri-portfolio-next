'use client';

import dynamic from 'next/dynamic';

const AuditMap = dynamic(() => import('./AuditMap'), {
  ssr: false,
  loading: () => (
    <div className="rounded-xl border border-fg/10 bg-white/[0.03] flex items-center justify-center text-fg-500 text-sm" style={{ height: 420 }}>
      Cargando mapa…
    </div>
  ),
});

export default function AuditMapLoader(props) {
  return <AuditMap {...props} />;
}
