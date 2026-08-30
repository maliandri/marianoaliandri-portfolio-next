'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { CLIENT_NAV_DEFAULT } from '@/data/clientNav';

export default function ClientNavShell() {
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
        const active = item.path && clean(pathname) === clean(item.path);
        return (
          <Link
            key={item.id}
            href={item.path || '#'}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              active ? 'bg-indigo-600 text-white' : 'bg-[#111] border border-white/10 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            <span>{item.icon}</span> {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
