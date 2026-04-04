import { products } from '@/data/products';

const BASE_URL = 'https://marianoaliandri.com.ar';

export default function sitemap() {
  const now = new Date().toISOString();

  const staticRoutes = [
    { url: `${BASE_URL}/`,           lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE_URL}/tienda/`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${BASE_URL}/ats/`,       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/roi/`,       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/kpi/`,       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/radarweb/`,  lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/web/`,       lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/stats/`,     lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
  ];

  const productRoutes = products.map((product) => ({
    url: `${BASE_URL}/tienda/${product.id}/`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
