import { describe, it, expect, vi } from 'vitest';
import {
  normalizeKeyword, keywordMatcher, isSafeUrl, countProducts,
} from './productCounter.js';
import { extractLocs, extractLatestLastmod, isSitemapIndex } from './sitemapUtils.js';

// Fetch falso: mapa url -> { status?, body?, headers? }. Cualquier otra URL da 404.
function makeFetch(routes) {
  return vi.fn(async (url) => {
    const r = routes[url];
    if (!r) return new Response('not found', { status: 404 });
    const status = r.status ?? 200;
    const body = status >= 300 && status < 400 ? null : (r.body ?? '');
    return new Response(body, { status, headers: r.headers || {} });
  });
}

const urlset = (urls, lastmod) =>
  `<?xml version="1.0"?><urlset>${urls.map(u => `<url><loc>${u}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`).join('')}</urlset>`;

describe('sitemapUtils', () => {
  it('extrae los <loc>', () => {
    expect(extractLocs(urlset(['https://a.test/x', 'https://a.test/y']))).toEqual(['https://a.test/x', 'https://a.test/y']);
  });
  it('extrae <loc> con CDATA', () => {
    expect(extractLocs('<urlset><url><loc><![CDATA[https://a.test/x]]></loc></url></urlset>')).toEqual(['https://a.test/x']);
  });
  it('devuelve el lastmod más reciente en ISO', () => {
    const xml = '<urlset><url><lastmod>2024-01-10</lastmod></url><url><lastmod>2025-03-05T10:00:00+00:00</lastmod></url></urlset>';
    expect(extractLatestLastmod(xml)).toBe('2025-03-05T10:00:00.000Z');
  });
  it('lastmod null si no hay o son inválidos', () => {
    expect(extractLatestLastmod('<urlset></urlset>')).toBeNull();
    expect(extractLatestLastmod('<urlset><url><lastmod>basura</lastmod></url></urlset>')).toBeNull();
  });
  it('detecta un sitemapindex', () => {
    expect(isSitemapIndex('<sitemapindex><sitemap><loc>x</loc></sitemap></sitemapindex>')).toBe(true);
    expect(isSitemapIndex(urlset(['https://a.test']))).toBe(false);
  });
});

describe('normalizeKeyword / keywordMatcher', () => {
  it('normaliza tildes, mayúsculas y espacios', () => {
    expect(normalizeKeyword('  CelulÁres ')).toBe('celulares');
  });
  it('matchea singular/plural, tildes y mayúsculas', () => {
    const m = keywordMatcher('Celulares');
    expect(m('/productos/celular-samsung-a15')).toBe(true);
    expect(m('CELULÁR Motorola')).toBe(true);
    expect(m('/productos/notebook-lenovo')).toBe(false);
  });
  it('keyword vacía no matchea nada', () => {
    expect(keywordMatcher('   ')('/cualquier-cosa')).toBe(false);
  });
});

describe('isSafeUrl', () => {
  it('acepta sitios públicos http/https', () => {
    expect(isSafeUrl('https://tienda.com.ar/x')).toBe(true);
    expect(isSafeUrl('http://tienda.com.ar')).toBe(true);
  });
  it.each([
    'http://localhost/x', 'http://127.0.0.1/', 'http://127.1/', 'http://10.0.0.5/',
    'http://192.168.1.1/', 'http://172.16.0.1/', 'http://169.254.169.254/latest',
    'http://[::1]/', 'http://intranet.local/', 'ftp://tienda.com/', 'file:///etc/passwd', 'no es url',
  ])('rechaza %s', (u) => {
    expect(isSafeUrl(u)).toBe(false);
  });
});

describe('countProducts', () => {
  const ORIGIN = 'https://tienda.test';

  it('Shopify: cuenta del catálogo real (products.json) → catalogo', async () => {
    const fetchImpl = makeFetch({
      [`${ORIGIN}/`]: { body: '<script src="https://cdn.shopify.com/x.js"></script>' },
      [`${ORIGIN}/products.json?limit=250&page=1`]: {
        body: JSON.stringify({ products: [
          { title: 'Celular Samsung A15', handle: 'a15', tags: [] },
          { title: 'Funda', handle: 'funda', product_type: 'Accesorio', tags: ['celular'] },
          { title: 'Notebook', handle: 'nb', tags: [] },
        ] }),
      },
    });
    const r = await countProducts(ORIGIN, 'celulares', { fetchImpl });
    expect(r).toEqual({ count: 2, confidence: 'catalogo', platform: 'shopify', partial: false });
  });

  it('WooCommerce: usa el total del Store API → catalogo', async () => {
    const fetchImpl = makeFetch({
      [`${ORIGIN}/`]: { body: '<link href="/wp-content/plugins/woocommerce/x.css">' },
      [`${ORIGIN}/wp-json/wc/store/v1/products?search=celular&per_page=1`]: { body: '[]', headers: { 'x-wp-total': '7' } },
    });
    const r = await countProducts(ORIGIN, 'Celulares', { fetchImpl });
    expect(r).toEqual({ count: 7, confidence: 'catalogo', platform: 'woocommerce', partial: false });
  });

  it('Tiendanube: cuenta las URLs /productos/ del sitemap → catalogo', async () => {
    const fetchImpl = makeFetch({
      [`${ORIGIN}/`]: { body: '<meta name="generator" content="Tiendanube">' },
      [`${ORIGIN}/sitemap.xml`]: { body: urlset([
        `${ORIGIN}/productos/celular-moto-g/`, `${ORIGIN}/productos/celular-iphone/`,
        `${ORIGIN}/productos/auriculares/`, `${ORIGIN}/celulares-usados/`,
      ]) },
    });
    const r = await countProducts(ORIGIN, 'celular', { fetchImpl });
    expect(r).toEqual({ count: 2, confidence: 'catalogo', platform: 'tiendanube', partial: false });
  });

  it('sin plataforma: cae al sitemap → estimado', async () => {
    const fetchImpl = makeFetch({
      [`${ORIGIN}/`]: { body: '<html>sitio a medida</html>' },
      [`${ORIGIN}/sitemap.xml`]: { body: urlset([`${ORIGIN}/celular-a`, `${ORIGIN}/celular-b`, `${ORIGIN}/contacto`]) },
    });
    const r = await countProducts(ORIGIN, 'celular', { fetchImpl });
    expect(r).toEqual({ count: 2, confidence: 'estimado', platform: null, partial: false });
  });

  it('sitemap index: prioriza el hijo de productos', async () => {
    const fetchImpl = makeFetch({
      [`${ORIGIN}/`]: { body: '<html></html>' },
      [`${ORIGIN}/sitemap.xml`]: { body: `<sitemapindex><sitemap><loc>${ORIGIN}/blog-sitemap.xml</loc></sitemap><sitemap><loc>${ORIGIN}/product-sitemap.xml</loc></sitemap></sitemapindex>` },
      [`${ORIGIN}/product-sitemap.xml`]: { body: urlset([`${ORIGIN}/celular-x`, `${ORIGIN}/tablet-y`]) },
      [`${ORIGIN}/blog-sitemap.xml`]: { body: urlset([`${ORIGIN}/blog/mejores-celulares`]) },
    });
    const r = await countProducts(ORIGIN, 'celular', { fetchImpl });
    expect(r.confidence).toBe('estimado');
    expect(r.count).toBe(2);
  });

  it('Shopify con products.json deshabilitado cae al sitemap', async () => {
    const fetchImpl = makeFetch({
      [`${ORIGIN}/`]: { body: 'cdn.shopify.com' },
      [`${ORIGIN}/sitemap.xml`]: { body: urlset([`${ORIGIN}/products/celular-1`]) },
    });
    const r = await countProducts(ORIGIN, 'celular', { fetchImpl });
    expect(r).toMatchObject({ count: 1, confidence: 'estimado', platform: 'shopify' });
  });

  it('sin catálogo ni sitemap → count null, sin excepción', async () => {
    const fetchImpl = makeFetch({ [`${ORIGIN}/`]: { body: '<html></html>' } });
    const r = await countProducts(ORIGIN, 'celular', { fetchImpl });
    expect(r).toEqual({ count: null, confidence: null, platform: null, partial: false });
  });

  it('sitio caído (fetch tira) → count null, sin excepción', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('ECONNREFUSED'); });
    const r = await countProducts(ORIGIN, 'celular', { fetchImpl });
    expect(r.count).toBeNull();
  });

  it('un HTML 200 que no es sitemap no cuenta como sitemap', async () => {
    const fetchImpl = makeFetch({
      [`${ORIGIN}/`]: { body: '<html></html>' },
      [`${ORIGIN}/sitemap.xml`]: { body: '<html><body>Página no encontrada</body></html>' },
    });
    const r = await countProducts(ORIGIN, 'celular', { fetchImpl });
    expect(r.count).toBeNull();
  });

  it('rechaza un redirect a un host privado y no le pega', async () => {
    const fetchImpl = makeFetch({
      [`${ORIGIN}/`]: { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } },
    });
    const r = await countProducts(ORIGIN, 'celular', { fetchImpl });
    expect(r.count).toBeNull();
    const called = fetchImpl.mock.calls.map(c => c[0]);
    expect(called.some(u => u.includes('169.254'))).toBe(false);
  });

  it('rechaza directamente un sitio con host privado', async () => {
    const fetchImpl = makeFetch({});
    const r = await countProducts('http://127.0.0.1:3000', 'celular', { fetchImpl });
    expect(r.count).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('presupuesto agotado → partial true y sin conteo', async () => {
    const fetchImpl = makeFetch({ [`${ORIGIN}/`]: { body: 'x' } });
    const r = await countProducts(ORIGIN, 'celular', { fetchImpl, budgetMs: 0 });
    expect(r.partial).toBe(true);
    expect(r.count).toBeNull();
  });

  it('acepta el sitio sin protocolo', async () => {
    const fetchImpl = makeFetch({
      [`${ORIGIN}/`]: { body: '<html></html>' },
      [`${ORIGIN}/sitemap.xml`]: { body: urlset([`${ORIGIN}/celular-1`]) },
    });
    const r = await countProducts('tienda.test', 'celular', { fetchImpl });
    expect(r.count).toBe(1);
  });

  it('keyword vacía → count null sin pegar a la red', async () => {
    const fetchImpl = makeFetch({});
    const r = await countProducts(ORIGIN, '  ', { fetchImpl });
    expect(r.count).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
