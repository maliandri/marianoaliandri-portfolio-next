const BASE_URL = 'https://marianoaliandri.com.ar';

export default function sitemap() {
  const now = new Date().toISOString();

  return [
    { url: `${BASE_URL}/`,            lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/presupuesto/`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/auditorias/`,  lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE_URL}/noticias/`,    lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
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
  ];
}
