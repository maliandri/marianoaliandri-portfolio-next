import { cache } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';

// ISR on-demand: una pieza publicada no cambia; se genera en la primera visita y queda en el CDN.
export const revalidate = 86400;
export async function generateStaticParams() { return []; }

const fecha = ms => new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
const WA = 'https://wa.me/5492995414422?text=';

// Solo las publicadas: los borradores (vista previa del admin) responden 404.
const getPieza = cache(async (id) => {
  const db = getDb();
  if (!db) return null;
  const doc = await db.collection('contenidos').doc(id).get();
  if (!doc.exists || doc.data().estado !== 'publicado') return null;
  const c = doc.data();
  return {
    id: doc.id, titulo: c.titulo, serie: c.serieNombre, cuerpo: c.cuerpo || [], imagenes: c.imagenes || [],
    cta: c.cta || { label: 'Pedí tu presupuesto', path: '/presupuesto/' }, fecha: c.publicadoAtMs, caption: c.caption,
  };
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = await getPieza(id);
  if (!p) return { title: 'Publicación no encontrada' };
  const url = `https://marianoaliandri.com.ar/aprende/${id}/`;
  const description = (p.cuerpo[0] || p.caption || '').slice(0, 160);
  return {
    title: `${p.titulo} | Aprendé`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article', url, title: p.titulo, description,
      ...(p.imagenes[0] ? { images: [{ url: p.imagenes[0], width: 1080, height: 1350, alt: p.titulo }] } : {}),
    },
  };
}

export default async function AprendeDetailPage({ params }) {
  const { id } = await params;
  const p = await getPieza(id);
  if (!p) notFound();
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Article', headline: p.titulo,
    datePublished: p.fecha ? new Date(p.fecha).toISOString() : undefined,
    author: { '@type': 'Person', name: 'Mariano Aliandri', url: 'https://marianoaliandri.com.ar' },
    image: p.imagenes[0], mainEntityOfPage: `https://marianoaliandri.com.ar/aprende/${p.id}/`,
  };

  return (
    <main className="min-h-screen bg-page pt-24 pb-20 px-4 md:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="max-w-3xl mx-auto">
        <Link href="/aprende/" className="text-xs text-fg-600 hover:text-fg-400 transition-colors mb-6 inline-block">← Todas las publicaciones</Link>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs bg-fg/5 border border-fg/10 text-fg-400 px-2.5 py-1 rounded-full">{p.serie}</span>
          {p.fecha && <span className="text-xs text-fg-600">{fecha(p.fecha)}</span>}
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-fg mb-8">{p.titulo}</h1>

        {p.imagenes.length > 0 && (
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 mb-10 -mx-1 px-1" aria-label="Carrusel de la publicación">
            {p.imagenes.map((src, i) => (
              <img key={src} src={src.replace('/upload/', '/upload/w_720,f_auto,q_auto/')} alt={`${p.titulo} — ${i + 1} de ${p.imagenes.length}`}
                width={720} height={900} loading={i ? 'lazy' : 'eager'}
                className="snap-start shrink-0 w-[78%] sm:w-[46%] rounded-2xl border border-fg/10" />
            ))}
          </div>
        )}

        <div className="text-fg-300 text-base leading-relaxed space-y-4 mb-12">
          {p.cuerpo.map((par, i) => <p key={i}>{par}</p>)}
        </div>

        <div className="glow-frame flex flex-col md:flex-row items-center justify-between gap-6 bg-card border border-fg/10 rounded-2xl px-8 py-6">
          <div>
            <p className="text-fg font-bold text-lg">¿Lo querés en tu negocio?</p>
            <p className="text-fg-500 text-sm mt-1">Sitio, base de datos, cobros y panel propio, conectado a Claude.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={p.cta.path} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 glow-btn whitespace-nowrap">
              {p.cta.label} <span aria-hidden>→</span>
            </Link>
            <a href={`${WA}${encodeURIComponent(`Hola Mariano, leí "${p.titulo}" y quiero saber más.`)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 border border-fg/20 hover:border-indigo-500/60 text-fg font-semibold px-6 py-3 rounded-xl whitespace-nowrap">
              WhatsApp
            </a>
          </div>
        </div>
      </article>
    </main>
  );
}
