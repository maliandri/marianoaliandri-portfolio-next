import Link from 'next/link';
import { getDb } from '@/lib/firebase-admin';
import { isBuildPhase } from '@/lib/isr';

// ISR: sale como mucho una pieza por día hábil; la corrida además llama revalidatePath.
export const revalidate = 3600;

const DESCRIPTION = 'Qué es un MCP, para qué una base de datos, cuánto cuesta una web para vender, cómo conectar tu negocio a Claude: explicado en simple para dueños de negocios.';

export const metadata = {
  title: 'Aprendé: tu negocio conectado a la IA',
  description: DESCRIPTION,
  alternates: { canonical: 'https://marianoaliandri.com.ar/aprende/' },
  openGraph: {
    type: 'website',
    url: 'https://marianoaliandri.com.ar/aprende/',
    title: 'Aprendé: tu negocio conectado a la IA | Mariano Aliandri',
    description: DESCRIPTION,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Aprendé — Mariano Aliandri' }],
  },
};

const fecha = ms => new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });

async function getPiezas() {
  try {
    const db = getDb();
    if (!db) return [];
    // Un solo filtro (sin índice compuesto); se ordena en memoria.
    const snap = await db.collection('contenidos').where('estado', '==', 'publicado').get();
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.publicadoAtMs || 0) - (a.publicadoAtMs || 0))
      .slice(0, 60)
      .map(c => ({ id: c.id, titulo: c.titulo, serie: c.serieNombre, portada: c.imagenes?.[0] || null, fecha: c.publicadoAtMs }));
  } catch (e) {
    if (isBuildPhase()) return [];
    throw e;
  }
}

export default async function AprendePage() {
  const piezas = await getPiezas();
  return (
    <main className="min-h-screen bg-page pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="hero-glow mb-12">
          <span className="text-xs font-semibold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">Aprendé</span>
          <h1 className="text-4xl md:text-5xl font-black text-fg mt-3 mb-4">Tu negocio, <span className="text-gradient">conectado a la IA</span></h1>
          <p className="text-fg-400 text-lg max-w-2xl">
            Qué es un MCP, para qué te sirve una base de datos, cuánto cuesta una web para vender y cómo manejar tu
            negocio hablando con Claude. En simple, sin tecnicismos.
          </p>
        </div>

        {piezas.length === 0 ? (
          <div className="text-center py-20 text-fg-600">
            <p className="text-5xl mb-4">✍️</p>
            <p className="text-lg">Muy pronto, las primeras publicaciones.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {piezas.map(p => (
              <Link key={p.id} href={`/aprende/${p.id}/`}
                className="glow-frame block bg-card border border-fg/10 hover:border-indigo-500/40 rounded-2xl overflow-hidden transition-colors group">
                {p.portada && (
                  <div className="aspect-[4/5] overflow-hidden">
                    <img src={p.portada.replace('/upload/', '/upload/w_600,f_auto,q_auto/')} alt={p.titulo} width={600} height={750}
                      loading="lazy" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-fg/5 border border-fg/10 text-fg-400 px-2.5 py-1 rounded-full">{p.serie}</span>
                    {p.fecha && <span className="text-xs text-fg-600">{fecha(p.fecha)}</span>}
                  </div>
                  <h2 className="text-fg font-bold text-lg group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{p.titulo}</h2>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
