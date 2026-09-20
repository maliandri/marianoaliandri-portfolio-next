'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { CLIENT_NAV_DEFAULT } from '@/data/clientNav';

// Labels EN por id de item — CLIENT_NAV_DEFAULT (y lo que devuelva /api/nav-config)
// solo trae texto en español, así que acá se traduce y se reescribe el path con el
// prefijo /en cuando corresponde, sin tocar la fuente de datos compartida con el admin.
const LABEL_EN = { demo: 'View demo', buscar: 'Search businesses' };

export default function ClientNavShell({ lang = 'es' }) {
  const [sections, setSections] = useState(CLIENT_NAV_DEFAULT);
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/nav-config?tree=client')
      .then(r => r.json())
      .then(data => { if (data.sections?.length) setSections(data.sections); })
      .catch(() => {});
  }, []);

  const clean = (p) => (p || '').replace(/\/$/, '');

  return (
    <nav className="flex flex-wrap gap-2 mb-6">
      {sections.flatMap(s => s.items).map(item => {
        const path = item.path
          ? (lang === 'en' && !item.path.startsWith('/en') ? `/en${item.path}` : item.path)
          : null;
        const label = lang === 'en' ? (LABEL_EN[item.id] || item.label) : item.label;
        const active = path && clean(pathname) === clean(path);
        return (
          <Link
            key={item.id}
            href={path || '#'}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              active ? 'bg-indigo-600 text-white' : 'bg-[#111] border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            <span>{item.icon}</span> {label}
          </Link>
        );
      })}
    </nav>
  );
}
