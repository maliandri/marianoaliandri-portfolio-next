'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function NoticiasHome() {
  const [noticias, setNoticias] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/noticias?public=1')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const cutoff = Date.now() - 60 * 60 * 1000;
        const recientes = (data.noticias || [])
          .filter(n => n.status === 'published' && n.publishedAt && new Date(n.publishedAt).getTime() >= cutoff)
          .slice(0, 4);
        setNoticias(recientes);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (noticias.length === 0) return null;

  return (
    <section className="bg-page px-6 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-2">
          <div>
            <p className="text-indigo-600 dark:text-indigo-400 text-sm font-semibold tracking-widest uppercase mb-3">
              Bot de noticias
            </p>
            <h2 className="text-3xl md:text-4xl font-black text-fg leading-tight">
              De la última hora
            </h2>
          </div>
          <Link href="/noticias/" className="text-sm text-fg-500 hover:text-fg transition-colors">
            Ver todas →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {noticias.map(n => (
            <Link
              key={n.id}
              href={`/noticias/${n.id}/`}
              className="glow-frame block bg-card border border-fg/10 hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-colors group"
            >
              {n.imageUrl && (
                <div className="aspect-video overflow-hidden">
                  <img src={n.imageUrl} alt={n.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-fg/5 border border-fg/10 text-fg-400 px-2 py-0.5 rounded-full">
                    {n.topicLabel}
                  </span>
                  <span className="text-xs text-fg-600">{formatTime(n.publishedAt)}</span>
                </div>
                <h3 className="text-fg font-bold text-sm leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {n.title}
                </h3>
                {!n.makeError && (
                  <p className="text-[11px] text-fg-600 mt-3">
                    Publicado en: Facebook · LinkedIn · Instagram
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
