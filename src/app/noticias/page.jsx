import Link from 'next/link';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Noticias',
  description: 'Noticias de los temas que sigo, resumidas y publicadas automáticamente.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/noticias/' },
  openGraph: {
    type: 'website',
    url: 'https://marianoaliandri.com.ar/noticias/',
    title: 'Noticias | Mariano Aliandri',
    description: 'Noticias de los temas que sigo, resumidas y publicadas automáticamente.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Noticias — Mariano Aliandri' }],
  },
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function getNoticias() {
  try {
    const db = getDb();
    if (!db) return [];
    const snap = await db.collection('noticias').orderBy('publishedAt', 'desc').limit(60).get();
    return snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          topicLabel: data.topicLabel,
          imageUrl: data.imageUrl,
          status: data.status,
          // Notas de tópicos "solo X" (visibleEnSitio:false) no se muestran en el sitio.
          visibleEnSitio: data.visibleEnSitio !== false,
          publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
        };
      })
      .filter(n => n.status === 'published' && n.visibleEnSitio)
      .slice(0, 30);
  } catch { return []; }
}

export default async function NoticiasPage() {
  const noticias = await getNoticias();

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-12">
          <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Canal de noticias</span>
          <h1 className="text-4xl md:text-5xl font-black text-white mt-3 mb-4">Noticias</h1>
          <p className="text-gray-400 text-lg max-w-2xl">
            Novedades de los temas que sigo, resumidas y publicadas automáticamente.
          </p>
        </div>

        {noticias.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-5xl mb-4">📰</p>
            <p className="text-lg">Todavía no hay noticias publicadas.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {noticias.map(n => (
              <Link
                key={n.id}
                href={`/noticias/${n.id}/`}
                className="block bg-[#111] border border-white/10 hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-colors group"
              >
                {n.imageUrl && (
                  <div className="aspect-video overflow-hidden">
                    <img src={n.imageUrl} alt={n.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
                      {n.topicLabel}
                    </span>
                    <span className="text-xs text-gray-600">{formatDate(n.publishedAt)}</span>
                  </div>
                  <h2 className="text-white font-bold text-lg group-hover:text-indigo-400 transition-colors">
                    {n.title}
                  </h2>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
