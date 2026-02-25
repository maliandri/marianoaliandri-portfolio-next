const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const IGNORE_EMAIL = ['example','test','noreply','no-reply','spam','sentry','wix','google','apple','microsoft','adobe','.png','.jpg','.gif','.svg'];
const PLACES_NEARBY = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACES_DETAIL = 'https://places.googleapis.com/v1/places/';

function extractEmails(text) {
  const found = [...new Set(text.match(EMAIL_RE) || [])];
  return found.filter(e => !IGNORE_EMAIL.some(x => e.toLowerCase().includes(x)));
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
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gApiKey, 'X-Goog-FieldMask': 'places.id,places.displayName,places.websiteUri,places.rating' },
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

      case 'searchEmail': {
        const { name, city } = params;
        const query = `"${name}" "${city}" correo OR email OR contacto`;
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        try {
          const resp = await fetch(ddgUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
          const html = await resp.text();
          const ddgEmails = extractEmails(html);
          if (ddgEmails.length) return ok({ email: ddgEmails[0], siteUrl: null });
          const linkMatch = html.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/);
          const siteUrl = linkMatch?.[1] || null;
          if (siteUrl && siteUrl.startsWith('http')) {
            try {
              const pageResp = await fetch(siteUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000) });
              if (pageResp.ok) {
                const pageText = await pageResp.text();
                const pageEmails = extractEmails(pageText);
                if (pageEmails.length) return ok({ email: pageEmails[0], siteUrl });
              }
            } catch { /* ignore */ }
          }
          return ok({ email: null, siteUrl });
        } catch { return ok({ email: null, siteUrl: null }); }
      }

      case 'checkSite': {
        let { url } = params;
        if (!url) return fail('URL requerida');
        if (!url.startsWith('http')) url = 'https://' + url;
        try {
          const { origin } = new URL(url);
          const [sitemapRes, robotsRes, mainRes] = await Promise.allSettled([
            fetch(origin + '/sitemap.xml', { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) }),
            fetch(origin + '/robots.txt', { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) }),
            fetch(origin, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(5000) }),
          ]);
          const hasSitemap = sitemapRes.status === 'fulfilled' && sitemapRes.value.status === 200;
          const hasRobots = robotsRes.status === 'fulfilled' && robotsRes.value.status === 200;
          let lastModified = null, pageEmail = null;
          if (mainRes.status === 'fulfilled' && mainRes.value.ok) {
            lastModified = mainRes.value.headers.get('last-modified') || null;
            try {
              const text = await mainRes.value.text();
              pageEmail = extractEmails(text)[0] || null;
            } catch { /* ignore */ }
          }
          return ok({ hasSitemap, hasRobots, lastModified, email: pageEmail });
        } catch { return ok({ hasSitemap: false, hasRobots: false, lastModified: null, email: null }); }
      }

      default:
        return fail(`Acción desconocida: ${action}`);
    }
  } catch (e) {
    return fail(e.message);
  }
}
