'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AUDIENCIAS, audienciaActiva } from '@/data/audiencias';

// Selector "¿para quién es esto?". variant="nav": dentro del Navbar oscuro (desktop).
// variant="inline": en el hero de cada página, solo en mobile (el Navbar lo esconde ahí).
export default function AudienceSwitch({ variant = 'nav', onNavigate }) {
  const activa = audienciaActiva(usePathname());

  if (variant === 'inline') {
    return (
      <nav aria-label="Elegí qué querés ver" className="lg:hidden w-full">
        <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-fg/5 border border-fg/10">
          {AUDIENCIAS.map(a => (
            <Link
              key={a.id}
              href={a.href}
              onClick={onNavigate}
              aria-current={activa === a.id ? 'page' : undefined}
              className={`text-center px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                activa === a.id ? 'bg-indigo-600 text-white' : 'text-fg-400 hover:text-fg hover:bg-fg/5'
              }`}
            >
              {a.label}
            </Link>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Elegí qué querés ver" className="flex items-center gap-0.5 p-1 rounded-full bg-white/5 border border-white/10">
      {AUDIENCIAS.map(a => (
        <Link
          key={a.id}
          href={a.href}
          onClick={onNavigate}
          aria-current={activa === a.id ? 'page' : undefined}
          title={a.label}
          className={`px-3 xl:px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activa === a.id ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span className="xl:hidden">{a.short}</span>
          <span className="hidden xl:inline">{a.label}</span>
        </Link>
      ))}
    </nav>
  );
}
