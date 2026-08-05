export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const IGNORE_EMAIL = ['example','test','noreply','no-reply','spam','sentry','wix','google','apple','microsoft','adobe','.png','.jpg','.gif','.svg'];
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SOCIAL_DOMAINS = [
  'facebook.com','fb.com','instagram.com','twitter.com','x.com',
  'linkedin.com','youtube.com','tiktok.com','pinterest.com','snapchat.com',
  'whatsapp.com','telegram.org','linktr.ee','beacons.ai','bio.link',
];

// Mapa de tipos (IDs de rubros.js) → tags OSM equivalentes
const OSM_TAGS = {
  // Gastronomía
  restaurant:           [{ k: 'amenity', v: 'restaurant' }],
  cafe:                 [{ k: 'amenity', v: 'cafe' }],
  bar:                  [{ k: 'amenity', v: 'bar' }],
  bakery:               [{ k: 'amenity', v: 'bakery' }, { k: 'shop', v: 'bakery' }],
  pizza_restaurant:     [{ k: 'amenity', v: 'restaurant' }],
  ice_cream_shop:       [{ k: 'amenity', v: 'ice_cream' }, { k: 'shop', v: 'ice_cream' }],
  meal_takeaway:        [{ k: 'amenity', v: 'fast_food' }],
  meal_delivery:        [{ k: 'amenity', v: 'fast_food' }],
  // Comercios
  store:                [{ k: 'shop', v: 'general' }],
  clothing_store:       [{ k: 'shop', v: 'clothes' }],
  shoe_store:           [{ k: 'shop', v: 'shoes' }],
  jewelry_store:        [{ k: 'shop', v: 'jewelry' }],
  hardware_store:       [{ k: 'shop', v: 'hardware' }],
  florist:              [{ k: 'shop', v: 'florist' }],
  pet_store:            [{ k: 'shop', v: 'pet' }],
  supermarket:          [{ k: 'shop', v: 'supermarket' }],
  convenience_store:    [{ k: 'shop', v: 'convenience' }],
  furniture_store:      [{ k: 'shop', v: 'furniture' }],
  electronics_store:    [{ k: 'shop', v: 'electronics' }],
  home_goods_store:     [{ k: 'shop', v: 'houseware' }],
  book_store:           [{ k: 'shop', v: 'books' }],
  gift_shop:            [{ k: 'shop', v: 'gift' }],
  sporting_goods_store: [{ k: 'shop', v: 'sports' }],
  bicycle_store:        [{ k: 'shop', v: 'bicycle' }],
  cell_phone_store:     [{ k: 'shop', v: 'mobile_phone' }],
  liquor_store:         [{ k: 'shop', v: 'alcohol' }],
  shopping_mall:        [{ k: 'shop', v: 'mall' }],
  // Salud & Belleza
  hair_care:            [{ k: 'shop', v: 'hairdresser' }],
  beauty_salon:         [{ k: 'shop', v: 'beauty' }],
  barber_shop:          [{ k: 'shop', v: 'hairdresser' }],
  nail_salon:           [{ k: 'shop', v: 'beauty' }],
  spa:                  [{ k: 'leisure', v: 'spa' }],
  gym:                  [{ k: 'leisure', v: 'fitness_centre' }],
  dentist:              [{ k: 'amenity', v: 'dentist' }],
  doctor:               [{ k: 'amenity', v: 'doctors' }],
  physiotherapist:      [{ k: 'amenity', v: 'physiotherapist' }, { k: 'healthcare', v: 'physiotherapist' }],
  pharmacy:             [{ k: 'amenity', v: 'pharmacy' }],
  veterinary_care:      [{ k: 'amenity', v: 'veterinary' }],
  // Serv. Profesionales
  real_estate_agency:   [{ k: 'office', v: 'estate_agent' }],
  lawyer:               [{ k: 'office', v: 'lawyer' }],
  accounting:           [{ k: 'office', v: 'accountant' }],
  insurance_agency:     [{ k: 'office', v: 'insurance' }],
  travel_agency:        [{ k: 'shop', v: 'travel_agency' }],
  photographer:         [{ k: 'craft', v: 'photographer' }, { k: 'office', v: 'photographer' }],
  // Automotor
  car_repair:           [{ k: 'shop', v: 'car_repair' }],
  car_dealer:           [{ k: 'shop', v: 'car' }],
  car_wash:             [{ k: 'amenity', v: 'car_wash' }],
  car_rental:           [{ k: 'amenity', v: 'car_rental' }],
  gas_station:          [{ k: 'amenity', v: 'fuel' }],
  // Hogar & Oficios
  electrician:          [{ k: 'craft', v: 'electrician' }],
  plumber:              [{ k: 'craft', v: 'plumber' }],
  painter:              [{ k: 'craft', v: 'painter' }],
  general_contractor:   [{ k: 'craft', v: 'construction' }],
  locksmith:            [{ k: 'craft', v: 'locksmith' }],
  laundry:              [{ k: 'shop', v: 'laundry' }, { k: 'amenity', v: 'laundry' }],
  moving_company:       [{ k: 'craft', v: 'transport' }],
  // Educación
  school:               [{ k: 'amenity', v: 'school' }],
  primary_school:       [{ k: 'amenity', v: 'school' }],
  secondary_school:     [{ k: 'amenity', v: 'school' }],
  preschool:            [{ k: 'amenity', v: 'kindergarten' }],
  university:           [{ k: 'amenity', v: 'university' }],
  // Alojamiento
  lodging:              [{ k: 'tourism', v: 'hotel' }, { k: 'tourism', v: 'hostel' }, { k: 'tourism', v: 'guest_house' }],
  hotel:                [{ k: 'tourism', v: 'hotel' }],
  motel:                [{ k: 'tourism', v: 'motel' }],
  campground:           [{ k: 'tourism', v: 'camp_site' }],
};

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

async function resourceOk(u) {
  try {
    const r = await fetch(u, { method: 'HEAD', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(7000) });
    if (r.ok) return true;
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

// Convierte un elemento de Overpass al formato uniforme que usa processPlaces
function parseOsmElement(el) {
  const t = el.tags || {};
  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;
  const website = t.website || t['contact:website'] || t['url'] || null;
  const phone   = t.phone   || t['contact:phone']   || t['contact:mobile'] || null;
  const street  = t['addr:street'] || '';
  const num     = t['addr:housenumber'] || '';
  return {
    id:          `${el.type}/${el.id}`,
    displayName: { text: t.name || t['name:es'] || '' },
    websiteUri:  website,
    rating:      null,
    location:    lat !== null ? { latitude: lat, longitude: lon } : null,
    _phone:      phone,
    _address:    [street, num].filter(Boolean).join(' '),
  };
}

const OVERPASS_LIMIT = 60;

function buildTagQuery(tags, lat, lon, radiusM) {
  const parts = tags.flatMap(({ k, v }) => [
    `node["${k}"="${v}"](around:${radiusM},${lat},${lon});`,
    `way["${k}"="${v}"](around:${radiusM},${lat},${lon});`,
  ]);
  return `[out:json][timeout:22];\n(\n${parts.join('\n')}\n);\nout center tags ${OVERPASS_LIMIT};`;
}

function buildNameQuery(term, lat, lon, radiusM) {
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `[out:json][timeout:22];\n(\n` +
    `node["name"~"${safe}",i](around:${radiusM},${lat},${lon});\n` +
    `way["name"~"${safe}",i](around:${radiusM},${lat},${lon});\n` +
    `);\nout center tags ${OVERPASS_LIMIT};`;
}

async function queryOverpass(query) {
  const resp = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(26000),
  });
  // 406 = query muy grande / rate limit → ignorar silenciosamente
  if (resp.status === 406 || resp.status === 429) return [];
  if (!resp.ok) throw new Error(`Overpass HTTP ${resp.status}`);
  const data = await resp.json();
  return (data.elements || []).map(parseOsmElement);
}

function ok(data)  { return Response.json({ ok: true, ...data }); }
function fail(msg) { return Response.json({ ok: false, error: msg }); }

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return fail('JSON inválido'); }

  const { action, ...params } = body;

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
        const { lat, lon, type, radiusM } = params;
        const tags = OSM_TAGS[type];
        if (!tags) return ok({ places: [], nextPageToken: null });
        const query  = buildTagQuery(tags, lat, lon, radiusM);
        const places = await queryOverpass(query);
        return ok({ places, nextPageToken: null });
      }

      case 'searchText': {
        const { lat, lon, query, radiusM } = params;
        if (!query) return fail('Término de búsqueda requerido');
        // Extrae solo el término antes de la coma (sin la ciudad)
        const term   = query.split(',')[0].trim();
        const oQuery = buildNameQuery(term, lat, lon, radiusM);
        const places = await queryOverpass(oQuery);
        return ok({ places, nextPageToken: null });
      }

      case 'checkSite': {
        let { url } = params;
        if (!url) return fail('URL requerida');
        if (!url.startsWith('http')) url = 'https://' + url;

        let origin;
        try { origin = new URL(url).origin; } catch { return fail('URL inválida'); }

        try {
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
            } catch { /* ignore */ }
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
