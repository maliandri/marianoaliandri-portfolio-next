import { getDb } from '@/lib/firebase-admin';
import { isBuildPhase } from '@/lib/isr';
import DemandaList from '@/components/demanda/DemandaList';

// ISR: salen como mucho 4 informes por semana; la corrida además llama revalidatePath.
export const revalidate = 3600;

const DESCRIPTION = 'Qué rubros busca la gente en Google en cada ciudad de Argentina: ranking semanal por zona, con las frases reales que escriben.';

export const metadata = {
  title: 'Qué se busca en Google por ciudad',
  description: DESCRIPTION,
  alternates: { canonical: 'https://marianoaliandri.com.ar/demanda/' },
  openGraph: {
    type: 'website',
    url: 'https://marianoaliandri.com.ar/demanda/',
    title: 'Qué se busca en Google por ciudad | Mariano Aliandri',
    description: DESCRIPTION,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Demanda de búsqueda por ciudad' }],
  },
};

async function getReportes() {
  try {
    const db = getDb();
    if (!db) return [];
    const snap = await db.collection('demanda_reportes').orderBy('createdAtMs', 'desc').limit(120).get();
    return snap.docs.map(d => {
      const r = d.data();
      return {
        id: d.id,
        zona: r.zona,
        localidades: r.localidades || [],
        provincias: r.provincias || [],
        createdAtMs: r.createdAtMs,
        top3: (r.top || []).slice(0, 3).map(t => t.label),
        rubros: (r.top || []).map(t => t.label),
      };
    });
  } catch (e) {
    if (isBuildPhase()) return [];
    throw e;
  }
}

export default async function DemandaPage() {
  const reportes = await getReportes();
  return (
    <main className="min-h-screen bg-page pt-24 pb-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="hero-glow mb-10">
          <span className="text-xs font-semibold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">Demanda de búsqueda</span>
          <h1 className="text-4xl md:text-5xl font-black text-fg mt-3 mb-4"><span className="text-gradient">Qué se busca</span> en tu ciudad</h1>
          <p className="text-fg-400 text-lg max-w-2xl">
            Los rubros que más busca la gente en Google, zona por zona, con las frases reales que escribe.
            Si tu rubro está arriba, hay clientes buscándote.
          </p>
        </div>
        <DemandaList reportes={reportes} />
      </div>
    </main>
  );
}
