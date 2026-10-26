import { notFound } from 'next/navigation';
import { IA_NICHOS, getNicho } from '@/data/iaNichos';
import NichoPage from '@/components/iaPara/NichoPage';

const BASE = 'https://marianoaliandri.com.ar';

// Una página estática por nicho (src/data/iaNichos.js). Un slug que no existe da 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return IA_NICHOS.map(n => ({ nicho: n.slug }));
}

export async function generateMetadata({ params }) {
  const nicho = getNicho((await params).nicho);
  if (!nicho) return {};
  const url = `${BASE}/ia-para/${nicho.slug}/`;
  return {
    title: nicho.seo.title,
    description: nicho.seo.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website', url, title: nicho.seo.title, description: nicho.seo.description,
      images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
    },
  };
}

export default async function Page({ params }) {
  const nicho = getNicho((await params).nicho);
  if (!nicho) notFound();
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Conectar la IA al sistema de ${nicho.nombre}`,
    serviceType: 'Integración de IA (servidor MCP a medida)',
    description: nicho.seo.description,
    url: `${BASE}/ia-para/${nicho.slug}/`,
    areaServed: 'AR',
    provider: { '@type': 'Person', name: 'Mariano Aliandri', url: BASE },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <NichoPage nicho={nicho} />
    </>
  );
}
