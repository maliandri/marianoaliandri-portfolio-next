// Utilidades puras para leer sitemaps XML. Sin red, sin dependencias.

// URLs (<loc>) de un sitemap o sitemap index. Acepta contenido en CDATA.
export function extractLocs(xml) {
  const out = [];
  const re = /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s][^<\]]*?)\s*(?:\]\]>)?\s*<\/loc>/gi;
  let m;
  while ((m = re.exec(String(xml || '')))) out.push(m[1]);
  return out;
}

export function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(String(xml || ''));
}

// Fecha <lastmod> más reciente del documento, en ISO. null si no hay ninguna válida.
export function extractLatestLastmod(xml) {
  const re = /<lastmod>\s*([^<]+?)\s*<\/lastmod>/gi;
  let max = 0;
  let m;
  while ((m = re.exec(String(xml || '')))) {
    const t = Date.parse(m[1]);
    if (Number.isFinite(t) && t > max) max = t;
  }
  return max ? new Date(max).toISOString() : null;
}
