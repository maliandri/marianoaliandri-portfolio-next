// Cuenta cuántos productos de un rubro/palabra tiene publicados un sitio web.
//  1. Si detecta la plataforma (Shopify / WooCommerce / Tiendanube) lee su catálogo → 'catalogo'.
//  2. Si no, cuenta las URLs del sitemap cuyo slug contiene la palabra → 'estimado'.
//  3. Si tampoco hay sitemap → count null.
// Todo el acceso a red pasa por un fetch inyectable y valida cada salto (SSRF): solo
// http/https y nunca hosts privados/locales. Limitación conocida: no resuelve DNS, así
// que un dominio público que apunte a una IP privada no se detecta.

import { extractLocs, isSitemapIndex } from './sitemapUtils.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 7000;
const MAX_REDIRECTS = 3;
const MAX_BODY_CHARS = 2_000_000;
const MAX_SITEMAP_LOCS = 5000;
const MAX_CHILD_SITEMAPS = 5;
const MAX_SHOPIFY_PAGES = 4;
const SHOPIFY_PAGE_SIZE = 250;

export function normalizeKeyword(str) {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Recorte simple de plural español. Como el match es por substring, pasarse de corto
// solo vuelve el match un poco más permisivo ("iphones" → "iphon" sigue matcheando "iphone").
function stem(token) {
  if (token.length > 4 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function keywordTokens(keyword) {
  return normalizeKeyword(keyword).split(' ').filter(Boolean).map(stem);
}

export function keywordMatcher(keyword) {
  const tokens = keywordTokens(keyword);
  if (!tokens.length) return () => false;
  return (text) => {
    const t = normalizeKeyword(text);
    return tokens.every(tok => t.includes(tok));
  };
}

export function isSafeUrl(input) {
  let u;
  try { u = new URL(input); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;

  if (host.includes(':')) { // IPv6
    return !(host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd')
      || host.startsWith('fe80') || host.startsWith('::ffff:'));
  }
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  }
  return true;
}

function detectPlatform(html) {
  if (/cdn\.shopify\.com|myshopify\.com|Shopify\.theme/i.test(html)) return 'shopify';
  if (/tiendanube|nuvemshop|mitiendanube/i.test(html)) return 'tiendanube';
  if (/woocommerce/i.test(html)) return 'woocommerce';
  return null;
}

// Cliente HTTP con presupuesto de tiempo total y redirects manuales validados.
function createClient(fetchImpl, budgetMs) {
  const deadline = Date.now() + budgetMs;
  const state = { partial: false };

  async function request(url) {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isSafeUrl(current)) return null;
      const left = deadline - Date.now();
      if (left <= 0) { state.partial = true; return null; }
      let res;
      try {
        res = await fetchImpl(current, {
          headers: { 'User-Agent': UA, Accept: '*/*' },
          redirect: 'manual',
          signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, left)),
        });
      } catch {
        if (Date.now() >= deadline) state.partial = true;
        return null;
      }
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) return null;
        try { current = new URL(loc, current).toString(); } catch { return null; }
        continue;
      }
      return res;
    }
    return null;
  }

  async function text(url) {
    const res = await request(url);
    if (!res || !res.ok) return null;
    try { return (await res.text()).slice(0, MAX_BODY_CHARS); } catch { return null; }
  }

  return { request, text, state };
}

async function countShopify(origin, matcher, c) {
  let count = 0;
  for (let page = 1; page <= MAX_SHOPIFY_PAGES; page++) {
    const res = await c.request(`${origin}/products.json?limit=${SHOPIFY_PAGE_SIZE}&page=${page}`);
    let products = null;
    if (res && res.ok) {
      try {
        const data = await res.json();
        if (Array.isArray(data.products)) products = data.products;
      } catch { /* respuesta no JSON */ }
    }
    if (!products) return page === 1 ? null : { count, partial: true };
    for (const p of products) {
      const hay = [p.title, p.product_type, p.handle, Array.isArray(p.tags) ? p.tags.join(' ') : p.tags]
        .filter(Boolean).join(' ');
      if (matcher(hay)) count++;
    }
    if (products.length < SHOPIFY_PAGE_SIZE) return { count, partial: false };
  }
  return { count, partial: true };
}

async function countWoo(origin, keyword, c) {
  const search = encodeURIComponent(keywordTokens(keyword).join(' '));
  const res = await c.request(`${origin}/wp-json/wc/store/v1/products?search=${search}&per_page=1`);
  if (!res || !res.ok) return null;
  const header = res.headers.get('x-wp-total');
  const total = header === null ? NaN : Number(header);
  return Number.isFinite(total) ? { count: total, partial: false } : null;
}

function pathOf(u) {
  try { return new URL(u).pathname; } catch { return String(u); }
}

// Lista de URLs del sitemap (o de los sitemaps hijos de un índice). null si no hay ninguno.
async function loadSitemapUrls(origin, c) {
  for (const root of [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`]) {
    const xml = await c.text(root);
    if (!xml) continue;

    let locs;
    let truncated = false;
    if (isSitemapIndex(xml)) {
      const children = extractLocs(xml);
      const isProducty = (u) => /product/i.test(u);
      const ordered = [...children.filter(isProducty), ...children.filter(u => !isProducty(u))];
      truncated = ordered.length > MAX_CHILD_SITEMAPS;
      locs = [];
      for (const child of ordered.slice(0, MAX_CHILD_SITEMAPS)) {
        const cx = await c.text(child);
        if (cx) locs.push(...extractLocs(cx));
        if (locs.length >= MAX_SITEMAP_LOCS) break;
      }
    } else {
      locs = extractLocs(xml);
    }
    if (!locs.length) continue; // p. ej. un 200 con HTML de "no encontrado"
    if (locs.length > MAX_SITEMAP_LOCS) { locs = locs.slice(0, MAX_SITEMAP_LOCS); truncated = true; }
    return { locs, truncated };
  }
  return null;
}

async function countFromSitemap(origin, matcher, c, productSegment) {
  const sm = await loadSitemapUrls(origin, c);
  if (!sm) return null;
  const productUrls = productSegment ? sm.locs.filter(u => u.includes(productSegment)) : [];
  const catalogLike = productUrls.length > 0;
  const pool = catalogLike ? productUrls : sm.locs;
  const count = pool.filter(u => matcher(pathOf(u))).length;
  return { count, partial: sm.truncated, catalogLike };
}

export async function countProducts(siteUrl, keyword, { fetchImpl = fetch, budgetMs = 20000 } = {}) {
  const none = (platform = null, partial = false) => ({ count: null, confidence: null, platform, partial });
  if (!normalizeKeyword(keyword)) return none();

  let origin;
  try {
    const u = new URL(/^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`);
    if (!isSafeUrl(u.href)) return none();
    origin = u.origin;
  } catch { return none(); }

  const c = createClient(fetchImpl, budgetMs);
  const matcher = keywordMatcher(keyword);

  const home = await c.text(`${origin}/`);
  const platform = detectPlatform(home || '');

  let result = null; // { count, partial, confidence }
  if (platform === 'shopify') {
    const r = await countShopify(origin, matcher, c);
    if (r) result = { ...r, confidence: 'catalogo' };
  } else if (platform === 'woocommerce') {
    const r = await countWoo(origin, keyword, c);
    if (r) result = { ...r, confidence: 'catalogo' };
  }

  if (!result) {
    const r = await countFromSitemap(origin, matcher, c, platform === 'tiendanube' ? '/productos/' : null);
    if (r) result = { count: r.count, partial: r.partial, confidence: r.catalogLike ? 'catalogo' : 'estimado' };
  }

  if (!result) return none(platform, c.state.partial);
  return { count: result.count, confidence: result.confidence, platform, partial: result.partial || c.state.partial };
}
