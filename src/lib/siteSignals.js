// Señales comerciales de un sitio, sacadas del HTML de la home que la auditoría ya descarga
// (sin costo extra): quién lo hizo, si pagan anuncios y en qué plataforma está.
// Idea tomada de ethanplusai/harvey: una agencia mal atribuida es peor que no decir nada, así
// que solo se guarda con un rótulo explícito ("Desarrollado por…") y nunca si es una plataforma.

const ROTULOS = [
  'desarrollad[oa] por', 'diseñad[oa] por', 'dise[ñn]o(?: web)?(?: y desarrollo)? por', 'dise[ñn]o web', 'sitio(?: web)? (?:por|de)',
  'p[aá]gina web por', 'hech[oa] por', 'realizad[oa] por', 'creado por', 'programad[oa] por', 'web por',
  'powered by', 'developed by', 'designed by', 'website by', 'site by', 'web design by', 'made by', 'built by',
];
// Límite de palabra a los dos lados: "sitio de" no puede matchear dentro de "sitio del propietario".
const ROTULO_RE = new RegExp(`(?<![a-záéíóúñ])(?:${ROTULOS.join('|')})(?![a-záéíóúñ])\\s*:?\\s*`, 'gi');

// Plataformas y herramientas que aparecen en "Powered by …" y no son una agencia.
const PLATAFORMAS = [
  'wordpress', 'woocommerce', 'elementor', 'wix', 'shopify', 'tiendanube', 'nuvemshop', 'empretienda', 'squarespace',
  'weebly', 'jimdo', 'godaddy', 'hostinger', 'blogger', 'google', 'joomla', 'drupal', 'prestashop', 'magento',
  'webflow', 'divi', 'astra', 'oceanwp', 'generatepress', 'cloudflare', 'mercadoshops', 'mercado shops', 'vtex',
  'odoo', 'framer', 'hubspot', 'zyro', 'site123', 'webnode', 'strikingly', 'carrd', 'canva', 'duda', 'bigcommerce',
  'yoast', 'rank math', 'jetpack', 'netlify', 'vercel', 'github', 'next.js', 'react', 'gatsby', 'hugo', 'tienda nube',
];

const quitarTags = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };
const esPlataforma = (txt) => { const t = String(txt || '').toLowerCase(); return PLATAFORMAS.some(p => t.includes(p)); };

// { nombre, url, confianza } o null. Con link a otro dominio → 0.9; nombre en texto → 0.75.
export function detectAgencia(html, siteUrl) {
  if (!html) return null;
  const propio = host(siteUrl);
  // Se mira el final de la página (pie): ahí va el crédito y se evita el texto del cuerpo.
  const pie = html.slice(Math.max(0, html.length - 60_000));
  ROTULO_RE.lastIndex = 0;
  let m;
  while ((m = ROTULO_RE.exec(pie))) {
    const resto = pie.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const link = resto.match(/^\s*(?:<[^a][^>]*>\s*)*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (link) {
      const url = link[1];
      const nombre = quitarTags(link[2]) || host(url);
      const h = host(url);
      if (!nombre || esPlataforma(nombre) || esPlataforma(h)) continue;
      if (h && propio && (h === propio || h.endsWith('.' + propio))) continue;
      if (h && /(facebook|instagram|wa\.me|whatsapp|linkedin|twitter|x\.com|youtube)/i.test(h)) {
        // Crédito con link a una red social: vale el nombre, sin URL.
        return nombre.length <= 60 ? { nombre, url: null, confianza: 0.75 } : null;
      }
      return { nombre: nombre.slice(0, 60), url: h ? url : null, confianza: h ? 0.9 : 0.75 };
    }
    // Sin link: el nombre es el texto que sigue al rótulo, hasta un corte de bloque o puntuación.
    const texto = quitarTags(resto.split(/<\/(?:p|div|li|span|footer|small)>|<br\s*\/?>/i)[0]).split(/[|·•©.\n]/)[0].trim();
    if (texto && texto.length >= 3 && texto.length <= 40 && !esPlataforma(texto) && /^[A-ZÁÉÍÓÚÑ0-9@]/.test(texto)) {
      return { nombre: texto, url: null, confianza: 0.75 };
    }
  }
  return null;
}

// Pauta paga detectada por sus etiquetas: píxel de Meta y conversiones de Google Ads.
export function detectAnuncios(html) {
  const h = String(html || '');
  const meta = /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(\s*['"]init['"]/i.test(h);
  const google = /googleadservices\.com\/pagead\/conversion|['"]AW-\d{6,}['"]|[?&]id=AW-\d{6,}/i.test(h);
  return { meta, google };
}

const GENERADORES = [
  ['WordPress', /<meta[^>]+generator[^>]+wordpress|\/wp-content\//i],
  ['Wix', /<meta[^>]+generator[^>]+wix|static\.wixstatic\.com/i],
  ['Tiendanube', /tiendanube|nuvemshop|d26lpennugtm8s\.cloudfront\.net/i],
  ['Shopify', /cdn\.shopify\.com|Shopify\.theme/i],
  ['Empretienda', /empretienda/i],
  ['Mercado Shops', /mercadoshops/i],
  ['Squarespace', /static1\.squarespace\.com/i],
  ['Webflow', /<meta[^>]+generator[^>]+webflow|website-files\.com/i],
  ['Joomla', /<meta[^>]+generator[^>]+joomla/i],
  ['GoDaddy', /img1\.wsimg\.com|<meta[^>]+generator[^>]+(?:go daddy|godaddy)/i],
  ['Next.js', /\/_next\/static\//i],
];

export function detectPlataforma(html) {
  const h = String(html || '');
  return GENERADORES.find(([, re]) => re.test(h))?.[0] || null;
}

export function siteSignals(html, siteUrl) {
  return { agencia: detectAgencia(html, siteUrl), anuncios: detectAnuncios(html), plataforma: detectPlataforma(html) };
}

// Frases para el mail o el admin, sin nombrar a la agencia ante el cliente.
export function señalesComerciales({ anuncios, plataforma } = {}) {
  const out = [];
  if (anuncios?.meta && anuncios?.google) out.push('pagan anuncios en Google y en Facebook/Instagram');
  else if (anuncios?.meta) out.push('pagan anuncios en Facebook/Instagram');
  else if (anuncios?.google) out.push('pagan anuncios en Google');
  if (plataforma) out.push(`el sitio está hecho en ${plataforma}`);
  return out;
}
