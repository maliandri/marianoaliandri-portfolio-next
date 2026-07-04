export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const IGNORE_EMAIL = ['example','test','noreply','no-reply','spam','sentry','wix','google','apple','microsoft','adobe','.png','.jpg','.gif','.svg'];
const PLACES_NEARBY = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACES_TEXT   = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_DETAIL = 'https://places.googleapis.com/v1/places/';
const SOCIAL_DOMAINS = [
  'facebook.com','fb.com','instagram.com','twitter.com','x.com',
  'linkedin.com','youtube.com','tiktok.com','pinterest.com','snapchat.com',
  'whatsapp.com','telegram.org','linktr.ee','beacons.ai','bio.link',
];

function isSocialUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return SOCIAL_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

function extractEmails(text) {
  const found = [...new Set(text.match(EMAIL_RE) || [])];
  return found.filter(e => !IGNORE_EMAIL.some(x => e.toLowerCase().includes(x)));
}

function extractMetaDesc(html) {
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,})["']/i)
           || html.match(/<meta[^>]+content=["']([^"']{10,})["'][^>]+name=["']description["']/i);
  return m ? m[1].trim().substring(0, 200) : null;
}

function detectOG(html) {
  return /<meta[^>]+property=["']og:/i.test(html);
}

async function fetchFirstContact(origin) {
  const paths = ['/contacto', '/contact', '/about'];
  try {
    return await Promise.any(
      paths.map(p =>
        fetch(origin + p, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) })
          .then(r => r.ok ? r : Promise.reject())
      )
    );
  } catch { return null; }
}

// Verifica que un recurso exista: HEAD y, si falla o lo rechazan, GET.
// Tolera cold starts (timeout largo) y servers que no soportan HEAD.
async function resourceOk(u) {
  try {
    const r = await fetch(u, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
    if (r.ok) return true;
    // 405/501/403 o error → reintentar con GET (muchos servers rechazan HEAD)
    const r2 = await fetch(u, { method: 'GET', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
    return r2.ok;
  } catch {
    try {
      const r2 = await fetch(u, { method: 'GET', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
      return r2.ok;
    } catch { return false; }
  }
}

function calcSeoScore({ hasSitemap, hasRobots, metaDesc, hasOG, lastModified }) {
  let score = 100;
  if (!hasSitemap) score -= 25;
  if (!hasRobots)  score -= 20;
  if (!metaDesc)   score -= 25;
  if (!hasOG)      score -= 15;
  if (lastModified) {
    const ageMonths = (Date.now() - new Date(lastModified).getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (ageMonths > 18) score -= 15;
  }
  return Math.max(0, score);
}

function ok(data) { return Response.json({ ok: true, ...data }); }
function fail(msg) { return Response.json({ ok: false, error: msg }); }

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return fail('JSON inválido'); }

  const { action, apiKey: clientKey, ...params } = body;
  const gApiKey = process.env.GOOGLE_PLACES_API_KEY || clientKey;

  try {
    switch (action) {
      case 'geocode': {
        const { city, country } = params;
        const q = encodeURIComponent(`${city}, ${country}`);
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, {
          headers: { 'User-Agent': 'LeadFinderAdmin/1.0' }, signal: AbortSignal.timeout(9000),
        });
        const data = await resp.json();
        if (!data.length) return fail(`Ciudad no encontrada: ${city}`);
        return ok({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
      }

      case 'searchNearby': {
        if (!gApiKey) return fail('API Key de Google requerida');
        const { lat, lon, type, radiusM, pageToken } = params;
        const reqBody = {
          includedTypes: [type],
          maxResultCount: 20,
          locationRestriction: { circle: { center: { latitude: lat, longitude: lon }, radius: parseFloat(radiusM) } },
        };
        if (pageToken) reqBody.pageToken = pageToken;
        const resp = await fetch(PLACES_NEARBY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gApiKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.rating,places.location' },
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(9000),
        });
        const data = await resp.json();
        if (data.error) return fail(data.error.message || 'Error de Google Places');
        return ok({ places: data.places || [], nextPageToken: data.nextPageToken || null });
      }

      case 'searchText': {
        if (!gApiKey) return fail('API Key de Google requerida');
        const { lat, lon, query, radiusM, pageToken } = params;
        if (!query) return fail('Término de búsqueda requerido');
        const reqBody = {
          textQuery: query,
          maxResultCount: 20,
          locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: parseFloat(radiusM) } },
        };
        if (pageToken) reqBody.pageToken = pageToken;
        const resp = await fetch(PLACES_TEXT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gApiKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.rating,places.location,nextPageToken' },
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(9000),
        });
        const data = await resp.json();
        if (data.error) return fail(data.error.message || 'Error de Google Places');
        return ok({ places: data.places || [], nextPageToken: data.nextPageToken || null });
      }

      case 'getDetails': {
        if (!gApiKey) return fail('API Key de Google requerida');
        const { placeId } = params;
        const resp = await fetch(PLACES_DETAIL + placeId, {
          headers: { 'X-Goog-Api-Key': gApiKey, 'X-Goog-FieldMask': 'id,displayName,formattedAddress,internationalPhoneNumber,websiteUri' },
          signal: AbortSignal.timeout(8000),
        });
        const data = await resp.json();
        return ok(data);
      }

      case 'checkSite': {
        let { url } = params;
        if (!url) return fail('URL requerida');
        if (!url.startsWith('http')) url = 'https://' + url;

        let origin;
        try { origin = new URL(url).origin; } catch { return fail('URL inválida'); }

        try {
          // robots.txt con GET (archivo chico): sirve para detectar existencia
          // y para leer si declara un Sitemap:.
          const [robotsRes, mainRes, contactRes] = await Promise.allSettled([
            fetch(origin + '/robots.txt', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) }),
            fetch(origin,                 { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }),
            fetchFirstContact(origin),
          ]);

          let hasRobots = false, declaredSitemap = null;
          if (robotsRes.status === 'fulfilled' && robotsRes.value.ok) {
            hasRobots = true;
            try {
              const txt = await robotsRes.value.text();
              const m = txt.match(/^\s*sitemap:\s*(\S+)/im);
              if (m) declaredSitemap = m[1].trim();
            } catch { /* ignore */ }
          }

          // Sitemap: probar /sitemap.xml, el declarado en robots, y /sitemap_index.xml.
          // Con HEAD→GET y timeout largo para no penalizar cold starts (Vercel/serverless).
          const candidates = [...new Set([
            origin + '/sitemap.xml',
            declaredSitemap,
            origin + '/sitemap_index.xml',
          ].filter(Boolean))];
          let hasSitemap = false;
          for (const cand of candidates) {
            if (await resourceOk(cand)) { hasSitemap = true; break; }
          }

          let lastModified = null, metaDesc = null, hasOG = false, emailFromHome = null;
          if (mainRes.status === 'fulfilled' && mainRes.value.ok) {
            lastModified = mainRes.value.headers.get('last-modified') || null;
            try {
              const html = await mainRes.value.text();
              emailFromHome = extractEmails(html)[0] || null;
              metaDesc      = extractMetaDesc(html);
              hasOG         = detectOG(html);
            } catch { /* ignore parse errors */ }
          }

          let emailFromContact = null;
          if (contactRes.status === 'fulfilled' && contactRes.value?.ok) {
            try {
              const contactHtml = await contactRes.value.text();
              emailFromContact = extractEmails(contactHtml)[0] || null;
            } catch { /* ignore */ }
          }

          const email    = emailFromHome || emailFromContact || null;
          const seoScore = calcSeoScore({ hasSitemap, hasRobots, metaDesc, hasOG, lastModified });

          return ok({ hasSitemap, hasRobots, lastModified, email, metaDesc, hasOG, seoScore });
        } catch {
          return ok({ hasSitemap: false, hasRobots: false, lastModified: null, email: null, metaDesc: null, hasOG: false, seoScore: null });
        }
      }

      default:
        return fail(`Acción desconocida: ${action}`);
    }
  } catch (e) {
    return fail(e.message);
  }
}
