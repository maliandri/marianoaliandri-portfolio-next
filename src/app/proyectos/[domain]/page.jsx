import Link from 'next/link';
import { notFound } from 'next/navigation';
import { google } from 'googleapis';
import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';
import { getDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

function getDateRange(days = 28, lag = 3) {
  const end = new Date();
  end.setDate(end.getDate() - lag);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

async function getProyecto(domain) {
  const auth = getGSCAuth();
  const sites = await getVerifiedSites(auth);
  const site = sites.find(s => s.domain === domain);
  if (!site) return null;

  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const dateRange = getDateRange();
  let clicks = 0;
  let impressions = 0;
  try {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: site.siteUrl,
      requestBody: { startDate: dateRange.startDate, endDate: dateRange.endDate, dimensions: [], rowLimit: 1 },
    });
    const row = res.data.rows?.[0] || {};
    clicks = row.clicks || 0;
    impressions = row.impressions || 0;
  } catch {
    // Sin stats disponibles, se muestran en 0 — no debe romper la página.
  }

  const db = getDb();
  const fsDoc = db ? (await db.collection('proyectos').doc(domain).get()).data() || {} : {};

  // Mismo criterio que /api/proyectos: oculto explícitamente (ej. proyecto
  // inactivo) no debe tener página de detalle pública tampoco.
  if (fsDoc.visible === false) return null;

  return {
    domain: site.domain,
    url: site.url,
    screenshotUrl: CLOUD_NAME
      ? `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200/MarianWeb/${site.domain}?v=${fsDoc.screenshotUpdatedAt || 0}`
      : null,
    descripcionCorta: fsDoc.descripcionCorta || '',
    stack: fsDoc.stack || '',
    funcionalidades: fsDoc.funcionalidades || '',
    impacto: fsDoc.impacto || '',
    media: (fsDoc.media || []).filter(m => m.publicable),
    clicks,
    impressions,
  };
}

export async function generateMetadata({ params }) {
  const { domain } = await params;
  const p = await getProyecto(domain);
  if (!p) return { title: 'Proyecto no encontrado' };
  const url = `https://marianoaliandri.com.ar/proyectos/${domain}`;
  const nombre = p.descripcionCorta?.split('·')[0]?.trim() || domain;
  const description = `${p.descripcionCorta} ${p.impacto}`.trim().slice(0, 160) || `Proyecto realizado por Mariano Aliandri: ${domain}`;
  return {
    title: `${nombre} | Proyectos`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: `${nombre} | Proyectos`,
      description,
      images: p.screenshotUrl ? [{ url: p.screenshotUrl, width: 1200, height: 630, alt: nombre }] : undefined,
    },
  };
}

export default async function ProyectoDetailPage({ params }) {
  const { domain } = await params;
  const p = await getProyecto(domain);
  if (!p) notFound();

  const nombre = p.descripcionCorta?.split('·')[0]?.trim() || domain;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://marianoaliandri.com.ar/' },
      { '@type': 'ListItem', position: 2, name: 'Proyectos', item: 'https://marianoaliandri.com.ar/#proyectos' },
      { '@type': 'ListItem', position: 3, name: nombre, item: `https://marianoaliandri.com.ar/proyectos/${domain}` },
    ],
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20 px-4 md:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="max-w-4xl mx-auto">
        <Link href="/#proyectos" className="text-xs text-gray-600 hover:text-gray-400 transition-colors mb-6 inline-block">
          ← Todos los proyectos
        </Link>

        <h1 className="text-3xl md:text-4xl font-black text-white mb-2">{nombre}</h1>
        {p.descripcionCorta && <p className="text-gray-400 text-base mb-8">{p.descripcionCorta}</p>}

        {p.screenshotUrl && (
          <div className="rounded-2xl overflow-hidden border border-white/10 mb-8">
            <img src={p.screenshotUrl} alt={nombre} className="w-full object-cover" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-[#111] border border-white/10 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-white">{p.clicks}</div>
            <div className="text-xs text-gray-500 mt-1">Clicks (28 días)</div>
          </div>
          <div className="bg-[#111] border border-white/10 rounded-xl p-5 text-center">
            <div className="text-3xl font-bold text-white">{p.impressions}</div>
            <div className="text-xs text-gray-500 mt-1">Impresiones (28 días)</div>
          </div>
        </div>

        {p.stack && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Stack técnico</p>
            <p className="text-gray-300 text-sm leading-relaxed">{p.stack}</p>
          </div>
        )}

        {p.funcionalidades && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Funcionalidades destacadas</p>
            <ul className="text-gray-300 text-sm leading-relaxed space-y-1 list-disc list-inside">
              {p.funcionalidades.split('\n').filter(Boolean).map((linea, i) => (
                <li key={i}>{linea.replace(/^→\s*/, '')}</li>
              ))}
            </ul>
          </div>
        )}

        {p.impacto && (
          <div className="mb-8 bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-5">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Impacto</p>
            <p className="text-gray-300 text-sm leading-relaxed">{p.impacto}</p>
          </div>
        )}

        {p.media.length > 0 && (
          <div className="mb-10">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Galería</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {p.media.map(m => (
                <div key={m.id} className="rounded-xl overflow-hidden border border-white/10">
                  {m.type === 'video' ? (
                    <video src={m.url} controls className="w-full h-40 object-contain bg-black" />
                  ) : (
                    <img src={m.url} alt={nombre} className="w-full h-40 object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>
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

        <p className="text-center text-xs text-gray-700 mt-8">
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300 transition-colors">
            Ver sitio en vivo ↗
          </a>
        </p>
      </div>
    </main>
  );
}
