import { IA_NICHOS } from '@/data/iaNichos';
import { getDb } from '@/lib/firebase-admin';
import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';

const BASE_URL = 'https://marianoaliandri.com.ar';

// Se regenera cada hora (ISR), no en cada pedido de un crawler.
export const revalidate = 3600;

const iso = (v) => {
  const ms = typeof v === 'number' ? v : v?.toMillis?.();
  return ms ? new Date(ms).toISOString() : undefined;
};

// Cada fuente falla por separado: si Firestore o GSC no responden, el sitemap sale
// igual con las rutas fijas y las demás fuentes.
async function safe(fn) {
  try {
    return await fn();
  } catch (e) {
    console.error('[sitemap]', e?.message || e);
    return [];
  }
}

// Mismos filtros que las páginas de detalle: lo que ahí da 404 no entra al sitemap.
async function dynamicEntries() {
  const db = getDb();
  if (!db) return [];

  const [auditorias, aprende, demanda, proyectos] = await Promise.all([
    safe(async () => {
      const snap = await db.collection('auditorias').orderBy('publishedAt', 'desc').limit(500).get();
      return snap.docs.map(d => ({
        url: `${BASE_URL}/auditorias/${d.id}/`,
        lastModified: iso(d.data().publishedAt),
        changeFrequency: 'monthly',
        priority: 0.6,
      }));
    }),
    safe(async () => {
      const snap = await db.collection('contenidos').where('estado', '==', 'publicado').get();
      return snap.docs.map(d => ({
        url: `${BASE_URL}/aprende/${d.id}/`,
        lastModified: iso(d.data().publicadoAtMs),
        changeFrequency: 'monthly',
        priority: 0.7,
      }));
    }),
    safe(async () => {
      const snap = await db.collection('demanda_reportes').orderBy('createdAtMs', 'desc').limit(500).get();
      return snap.docs.map(d => ({
        url: `${BASE_URL}/demanda/${d.id}/`,
        lastModified: iso(d.data().createdAtMs),
        changeFrequency: 'monthly',
        priority: 0.6,
      }));
    }),
    safe(async () => {
      const sites = await getVerifiedSites(getGSCAuth());
      // Sin barra final: los dominios llevan punto (ver CLAUDE.md, trailingSlash).
      return sites.map(s => ({
        url: `${BASE_URL}/proyectos/${s.domain}`,
        changeFrequency: 'monthly',
        priority: 0.6,
      }));
    }),
  ]);

  return [...auditorias, ...aprende, ...demanda, ...proyectos];
}

export default async function sitemap() {
  const now = new Date().toISOString();

  return [
    { url: `${BASE_URL}/`,            lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/presupuesto/`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/tienda/`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/auditorias/`,  lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/noticias/`,    lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE_URL}/aprende/`,     lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE_URL}/demanda/`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/lead-finder-pro/`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/en/lead-finder-pro/`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/herramientas/`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/ats/`,        lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/roi/`,        lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/kpi/`,        lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/radarweb/`,   lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/web/`,        lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/keywords/`,   lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/analitica/`,   lastModified: now, changeFrequency: 'daily',   priority: 0.8 },
    { url: `${BASE_URL}/faq/`,                    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/politica-devoluciones/`, lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${BASE_URL}/stats/`,                 lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/ia-para/`,               lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    ...IA_NICHOS.map(n => ({ url: `${BASE_URL}/ia-para/${n.slug}/`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 })),
    ...(await safe(dynamicEntries)),
  ];
}
