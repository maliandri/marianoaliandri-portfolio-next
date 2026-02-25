/**
 * lead-finder.js — Proxy function para Lead Finder en el admin panel.
 *
 * Actions:
 *   geocode      — Geocodifica ciudad con Nominatim
 *   searchNearby — Google Places (New) Nearby Search
 *   getDetails   — Google Places (New) Place Details
 *   searchEmail  — DuckDuckGo scraping para buscar email + URL del negocio
 *   checkSite    — Verifica sitemap.xml, robots.txt y last-modified de un sitio
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const IGNORE_EMAIL = [
  'example', 'test', 'noreply', 'no-reply', 'spam', 'sentry', 'wix',
  'google', 'apple', 'microsoft', 'adobe', '.png', '.jpg', '.gif', '.svg',
];

const PLACES_NEARBY = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACES_DETAIL = 'https://places.googleapis.com/v1/places/';

function extractEmails(text) {
  const found = [...new Set(text.match(EMAIL_RE) || [])];
  return found.filter(e => !IGNORE_EMAIL.some(x => e.toLowerCase().includes(x)));
}

function ok(data) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ...data }) };
}

function fail(msg) {
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, error: msg }) };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS };

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return fail('JSON inválido');
  }

  const { action, apiKey: clientKey, ...params } = body;
  const gApiKey = process.env.GOOGLE_PLACES_API_KEY || clientKey;

  try {
    switch (action) {

      // ── Geocode ────────────────────────────────────────────────────
      case 'geocode': {
        const { city, country } = params;
        const q = encodeURIComponent(`${city}, ${country}`);
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
          { headers: { 'User-Agent': 'LeadFinderAdmin/1.0' }, signal: AbortSignal.timeout(9000) }
        );
        const data = await resp.json();
        if (!data.length) return fail(`Ciudad no encontrada: ${city}`);
        return ok({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
      }

      // ── Nearby Search ──────────────────────────────────────────────
      case 'searchNearby': {
        if (!gApiKey) return fail('API Key de Google requerida');
        const { lat, lon, type, radiusM, pageToken } = params;

        const reqBody = {
          includedTypes: [type],
          maxResultCount: 20,
          locationRestriction: {
            circle: { center: { latitude: lat, longitude: lon }, radius: parseFloat(radiusM) },
          },
        };
        if (pageToken) reqBody.pageToken = pageToken;

        const resp = await fetch(PLACES_NEARBY, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': gApiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.rating',
          },
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(9000),
        });
        const data = await resp.json();
        if (data.error) return fail(data.error.message || 'Error de Google Places');
        return ok({ places: data.places || [], nextPageToken: data.nextPageToken || null });
      }

      // ── Place Details ──────────────────────────────────────────────
      case 'getDetails': {
        if (!gApiKey) return fail('API Key de Google requerida');
        const { placeId } = params;

        const resp = await fetch(PLACES_DETAIL + placeId, {
          headers: {
            'X-Goog-Api-Key': gApiKey,
            'X-Goog-FieldMask':
              'id,displayName,formattedAddress,internationalPhoneNumber,websiteUri',
          },
          signal: AbortSignal.timeout(8000),
        });
        const data = await resp.json();
        return ok(data);
      }

      // ── Search Email (DuckDuckGo) ──────────────────────────────────
      case 'searchEmail': {
        const { name, city } = params;
        const query = `"${name}" "${city}" correo OR email OR contacto`;
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

        try {
          const resp = await fetch(ddgUrl, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(8000),
          });
          const html = await resp.text();

          // 1. Email directo en los resultados
          const ddgEmails = extractEmails(html);
          if (ddgEmails.length) return ok({ email: ddgEmails[0], siteUrl: null });

          // 2. Extraer URL del primer resultado (href en result__a)
          const linkMatch = html.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/);
          const siteUrl = linkMatch?.[1] || null;

          if (siteUrl && siteUrl.startsWith('http')) {
            try {
              const pageResp = await fetch(siteUrl, {
                headers: { 'User-Agent': UA },
                signal: AbortSignal.timeout(5000),
              });
              if (pageResp.ok) {
                const pageText = await pageResp.text();
                const pageEmails = extractEmails(pageText);
                if (pageEmails.length) return ok({ email: pageEmails[0], siteUrl });
              }
            } catch { /* page fetch failed */ }
          }

          return ok({ email: null, siteUrl });

        } catch {
          return ok({ email: null, siteUrl: null });
        }
      }

      // ── Check Site (sitemap, robots, last-modified) ────────────────
      case 'checkSite': {
        let { url } = params;
        if (!url) return fail('URL requerida');
        if (!url.startsWith('http')) url = 'https://' + url;

        try {
          const { origin } = new URL(url);

          // Tres requests en paralelo
          const [sitemapRes, robotsRes, mainRes] = await Promise.allSettled([
            fetch(origin + '/sitemap.xml', {
              method: 'HEAD',
              headers: { 'User-Agent': UA },
              signal: AbortSignal.timeout(4000),
            }),
            fetch(origin + '/robots.txt', {
              method: 'HEAD',
              headers: { 'User-Agent': UA },
              signal: AbortSignal.timeout(4000),
            }),
            fetch(origin, {
              headers: { 'User-Agent': UA },
              signal: AbortSignal.timeout(5000),
            }),
          ]);

          const hasSitemap =
            sitemapRes.status === 'fulfilled' && sitemapRes.value.status === 200;
          const hasRobots =
            robotsRes.status === 'fulfilled' && robotsRes.value.status === 200;

          let lastModified = null;
          let pageEmail = null;

          if (mainRes.status === 'fulfilled' && mainRes.value.ok) {
            lastModified = mainRes.value.headers.get('last-modified') || null;
            try {
              const text = await mainRes.value.text();
              const emails = extractEmails(text);
              pageEmail = emails[0] || null;
            } catch { /* ignore */ }
          }

          return ok({ hasSitemap, hasRobots, lastModified, email: pageEmail });

        } catch (e) {
          return ok({ hasSitemap: false, hasRobots: false, lastModified: null, email: null });
        }
      }

      default:
        return fail(`Acción desconocida: ${action}`);
    }

  } catch (e) {
    return fail(e.message);
  }
}
