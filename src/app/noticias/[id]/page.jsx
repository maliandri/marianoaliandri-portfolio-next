import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function getNoticia(id) {
  try {
    const db = getDb();
    if (!db) return null;
    const doc = await db.collection('noticias').doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    if (data.status !== 'published') return null;
    return {
      id: doc.id,
      ...data,
      publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
    };
  } catch { return null; }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const n = await getNoticia(id);
  if (!n) return { title: 'Noticia no encontrada' };
  const url = `https://marianoaliandri.com.ar/noticias/${id}/`;
  const description = (n.body || '').slice(0, 160);
  return {
    title: `${n.title} | Noticias`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: n.title,
      description,
      images: n.imageUrl ? [{ url: n.imageUrl, width: 1200, height: 630, alt: n.title }] : undefined,
    },
  };
}

export default async function NoticiaDetailPage({ params }) {
  const { id } = await params;
  const n = await getNoticia(id);
  if (!n) notFound();

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/noticias" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 inline-block">
          ← Todas las noticias
        </Link>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs bg-white/5 border border-white/10 text-gray-400 px-2.5 py-1 rounded-full">
            {n.topicLabel}
          </span>
          <span className="text-xs text-gray-600">{formatDate(n.publishedAt)}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-black text-white mb-6">{n.title}</h1>

        {n.imageUrl && (
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-8">
            <img src={n.imageUrl} alt={n.title} className="w-full object-cover" />
          </div>
        )}

        <div className="text-gray-300 text-base leading-relaxed space-y-4 mb-10">
          {(n.body || '').split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        </div>

        {n.sourceUrl && (
          <p className="text-xs text-gray-600 mb-10">
            Fuente:{' '}
            <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              {n.sourceTitle || n.sourceUrl}
            </a>
          </p>
        )}

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[#111] border border-white/10 rounded-2xl px-8 py-6">
          <div>
            <p className="text-white font-bold text-lg">¿Querés algo parecido para tu negocio?</p>
            <p className="text-gray-500 text-sm mt-1">Hablemos. Primera consulta sin cargo.</p>
          </div>
          <Link
            href="/presupuesto"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
          >
            Pedir presupuesto <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
