'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

// Toggle ES/EN acotado a /lead-finder-pro y /en/lead-finder-pro — calcula la ruta
// espejada agregando/sacando el prefijo /en, preservando el resto del path.
export default function LanguageSwitch() {
  const pathname = usePathname() || '/';
  const isEn = pathname === '/en' || pathname.startsWith('/en/');
  const targetPath = isEn
    ? (pathname.replace(/^\/en(\/|$)/, '/') || '/lead-finder-pro')
    : `/en${pathname}`;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Link
        href={isEn ? targetPath : pathname}
        className={`px-2 py-1 rounded-md transition-colors ${!isEn ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
      >
        ES
      </Link>
      <span className="text-gray-700">/</span>
      <Link
        href={isEn ? pathname : targetPath}
        className={`px-2 py-1 rounded-md transition-colors ${isEn ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
      >
        EN
      </Link>
    </div>
  );
}
