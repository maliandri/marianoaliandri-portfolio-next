// Saca el @ de Instagram de un negocio a partir del HTML de su sitio (links a instagram.com)
// o de la "web" que cargó en Google Maps cuando es directamente su perfil de Instagram.
// Sirve para el Lead Finder: lista de cuentas a las que escribirles por DM.

// Primer segmento de instagram.com/<algo> que NO es un perfil.
const RESERVADOS = new Set([
  'p', 'reel', 'reels', 'tv', 'explore', 'accounts', 'stories', 'about', 'developer',
  'legal', 'direct', 'web', 'share', 's', 'sharer', 'embed', 'embed.js', 'oauth', 'challenge',
  'privacy', 'terms', 'help', 'press', 'api', 'static', 'instagram', 'graphql', 'ar', 'en',
  // Cuentas de plataformas que aparecen en el footer de páginas que no son del negocio
  // (ej. un "sitio" que es un link wa.me → página de WhatsApp → @whatsapp).
  'whatsapp', 'facebook', 'meta', 'threads', 'wix', 'shopify', 'tiendanube', 'mercadolibre',
  'mercadopago', 'vtex', 'godaddy', 'wordpress', 'linktree', 'google',
]);

// instagram.com/handle, también escapado dentro de JSON (instagram.com\/handle) y instagr.am.
const IG_RE = /(?:https?:)?(?:\\?\/\\?\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\\?\/([A-Za-z0-9._]{1,30})/gi;

export function handleFromUrl(url) {
  if (!url) return null;
  IG_RE.lastIndex = 0;
  const m = IG_RE.exec(String(url));
  return m ? normalizar(m[1]) : null;
}

function normalizar(raw) {
  const h = raw.toLowerCase().replace(/\.+$/, '');
  if (!h || RESERVADOS.has(h)) return null;
  if (/^\d+$/.test(h)) return null; // ids numéricos, no perfiles
  return h;
}

// Si el sitio enlaza varios perfiles (ej. el de la agencia que lo hizo en el footer),
// gana el que más se repite.
export function extractInstagram(html) {
  if (!html) return null;
  const conteo = new Map();
  for (const m of String(html).matchAll(IG_RE)) {
    const h = normalizar(m[1]);
    if (h) conteo.set(h, (conteo.get(h) || 0) + 1);
  }
  let mejor = null, max = 0;
  for (const [h, n] of conteo) if (n > max) { mejor = h; max = n; }
  return mejor;
}
