export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getUserFromRequest } from '@/lib/authServer';

// Cuenta registrada (Firebase Auth) reconocida como admin para esta ruta interna.
// No es un password aparte -- es la MISMA cuenta con la que Mariano se loguea en el
// sitio. Cualquier otro usuario autenticado NO puede llamar esta ruta directo (así no
// evita el gate de créditos de /api/lead-finder-pro/run).
// Sin fallback hardcodeado: si ADMIN_EMAIL no está seteada en las env vars, la ruta
// queda cerrada para todos en vez de aceptar un email fijo en el código.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || null;

// Caché de auditorías por placeId — evita re-pagar getDetails (Places API) por un
// negocio ya auditado. El sitio propio (checkSite) es gratis, así que solo importa
// cachear el resultado combinado. TTL amplio: el SEO de un negocio no cambia seguido.
const CACHE_COLLECTION = 'places_seo_cache';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// Contador propio de uso diario (Google no expone las cuotas de Places API por
// Cloud Monitoring — confirmado a mano, es una limitación de Maps Platform). Un doc
// por día UTC, incrementado en cada llamada real a Google (no en cache hits).
const USAGE_COLLECTION = 'leadfinder_usage';
function todayKey() { return new Date().toISOString().slice(0, 10); }
async function bumpUsage(field, n = 1) {
  try {
    const db = getDb();
    if (!db) return;
    await db.collection(USAGE_COLLECTION).doc(todayKey()).set(
      { [field]: FieldValue.increment(n), updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  } catch { /* el contador es informativo, nunca debe romper la acción real */ }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const IGNORE_EMAIL = ['example','test','noreply','no-reply','spam','sentry','wix','google','apple','microsoft','adobe','.png','.jpg','.gif','.svg'];
const PLACES_NEARBY = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACES_TEXT   = 'https://places.googleapis.com/v1/places:searchText';
const SOCIAL_DOMAINS = [
  'facebook.com','fb.com','instagram.com','twitter.com','x.com',
  'linkedin.com','youtube.com','tiktok.com','pinterest.com','snapchat.com',
  'whatsapp.com','telegram.org','linktr.ee','beacons.ai','bio.link',
];

const PLACES_DETAIL  = 'https://places.googleapis.com/v1/places/';
// Campos del search: sin websiteUri (no viene en search, solo en getDetails)
const SEARCH_FIELDS  = 'places.id,places.displayName,places.rating,places.location';
// Campos del detail: website + teléfono/horarios/rating. Todos confirmados en el mismo
// tier "Enterprise" de Google ($20/1.000) que websiteUri solo — agregarlos no sube el
// costo por negocio. Evitar "reviews"/campos de "Atmosphere" (esos sí suben de tier).
const DETAIL_FIELDS  = 'id,websiteUri,nationalPhoneNumber,regularOpeningHours,rating,userRatingCount';

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

function ok(data) { return Response.json({ ok: true, ...data }); }
function fail(msg, code) { return Response.json({ ok: false, error: msg, code }); }

// Google devuelve status 'RESOURCE_EXHAUSTED' cuando se pasa la cuota diaria de
// getDetails (tope puesto a mano en GCP Console en 100/día para evitar facturación
// sorpresa — ver memoria google-cloud-quotas). Se distingue con un `code` propio para
// que el frontend muestre un aviso claro en vez de "reintentar" fila por fila (reintentar
// no sirve de nada hasta que resetee la cuota).
function detailsError(err) {
  if (err?.status === 'RESOURCE_EXHAUSTED') {
    return fail('Se alcanzó el límite diario de auditorías de Google Places. Se restablece automáticamente — probá de nuevo más tarde.', 'QUOTA_EXCEEDED');
  }
  return fail(err?.message || 'Error de Google Places (getDetails)');
}

// Auditoría SEO de un sitio (sitemap/robots/meta/OG/email) — sin costo, solo fetches propios.
// Compartida por la acción 'checkSite' (uno por uno) y 'auditPlace' (con caché por placeId).
async function auditSite(url) {
  if (!url.startsWith('http')) url = 'https://' + url;
  let origin;
  try { origin = new URL(url).origin; } catch { throw new Error('URL inválida'); }

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

    return { hasSitemap, hasRobots, lastModified, email, metaDesc, hasOG, seoScore };
  } catch {
    return { hasSitemap: false, hasRobots: false, lastModified: null, email: null, metaDesc: null, hasOG: false, seoScore: null };
  }
}

// Lógica pura de las acciones (Places API + auditoría SEO), sin ningún chequeo de auth --
// eso queda a cargo de quien la invoque: el POST de acá abajo (solo cuenta admin) y
// /api/lead-finder-pro/run (cualquier usuario registrado + descuento de crédito).
// Se llama directo (no por HTTP) para no pisar el auth de cada caller.
export async function runLeadFinderAction(action, params, clientKey) {
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
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gApiKey, 'X-Goog-FieldMask': SEARCH_FIELDS },
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(9000),
        });
        const data = await resp.json();
        if (data.error) return fail(data.error.message || 'Error de Google Places');
        await bumpUsage('searchNearbyRequests');
        // Normalizar al formato que usa processPlaces
        const places = (data.places || []).map(p => ({
          ...p,
          _phone:   '',
          _address: '',
        }));
        return ok({ places, nextPageToken: data.nextPageToken || null });
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
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': gApiKey, 'X-Goog-FieldMask': SEARCH_FIELDS + ',nextPageToken' },
          body: JSON.stringify(reqBody),
          signal: AbortSignal.timeout(9000),
        });
        const data = await resp.json();
        if (data.error) return fail(data.error.message || 'Error de Google Places');
        await bumpUsage('searchTextRequests');
        const places = (data.places || []).map(p => ({
          ...p,
          _phone:   '',
          _address: '',
        }));
        return ok({ places, nextPageToken: data.nextPageToken || null });
      }

      case 'getDetails': {
        if (!gApiKey) return fail('API Key de Google requerida');
        const { placeId } = params;
        const resp = await fetch(PLACES_DETAIL + placeId, {
          headers: { 'X-Goog-Api-Key': gApiKey, 'X-Goog-FieldMask': DETAIL_FIELDS },
          signal: AbortSignal.timeout(8000),
        });
        const data = await resp.json();
        if (data.error) return detailsError(data.error);
        await bumpUsage('getPlaceRequests');
        return ok(data);
      }

      case 'checkSite': {
        const { url } = params;
        if (!url) return fail('URL requerida');
        return ok(await auditSite(url));
      }

      // Auditoría de un place con caché por placeId en Firestore (30 días).
      // Si está en caché, NO llama a Google — cero costo. Si no, llama a getDetails
      // (pago) + auditSite (gratis) una sola vez y guarda el resultado para el futuro.
      case 'auditPlace': {
        const { placeId } = params;
        if (!placeId) return fail('placeId requerido');

        const db = getDb();
        const cacheRef = db ? db.collection(CACHE_COLLECTION).doc(placeId) : null;

        if (cacheRef) {
          try {
            const snap = await cacheRef.get();
            if (snap.exists) {
              const cached = snap.data();
              const checkedAt = cached.checkedAt?.toDate?.()?.getTime() || 0;
              if (Date.now() - checkedAt < CACHE_TTL_MS) {
                await bumpUsage('cacheHits');
                const { checkedAt: _omit, ...rest } = cached;
                return ok({ ...rest, fromCache: true });
              }
            }
          } catch { /* si falla la lectura, seguimos y auditamos igual */ }
        }

        if (!gApiKey) return fail('API Key de Google requerida');
        const detResp = await fetch(PLACES_DETAIL + placeId, {
          headers: { 'X-Goog-Api-Key': gApiKey, 'X-Goog-FieldMask': DETAIL_FIELDS },
          signal: AbortSignal.timeout(8000),
        });
        const detData = await detResp.json();
        if (detData.error) return detailsError(detData.error);
        await bumpUsage('getPlaceRequests');

        const websiteUri = detData.websiteUri && !isSocialUrl(detData.websiteUri) ? detData.websiteUri : null;
        let result = {
          hasWebsite: !!websiteUri, siteUrl: websiteUri,
          seoScore: null, hasSitemap: null, hasRobots: null, metaDesc: null, hasOG: false, email: null,
          phone: detData.nationalPhoneNumber || null,
          openingHours: detData.regularOpeningHours?.weekdayDescriptions || null,
          rating: detData.rating ?? null,
          ratingCount: detData.userRatingCount ?? null,
        };

        if (websiteUri) {
          const site = await auditSite(websiteUri);
          result = { ...result, ...site };
        }

        if (cacheRef) {
          await cacheRef.set({ ...result, checkedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => {});
        }

        return ok({ ...result, fromCache: false });
      }

      default:
        return fail(`Acción desconocida: ${action}`);
    }
  } catch (e) {
    return fail(e.message);
  }
}

// Ruta interna del admin (panel /admin — LeadFinderPanel y LeadMapPanel). Sin esto,
// cualquiera que encuentre esta URL puede llamarla directo y gastar la cuota de Google
// Places sin login ni nada. Solo la cuenta admin registrada puede usarla directo -- el
// resto pasa por /api/lead-finder-pro/run, que sí descuenta créditos.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return fail('JSON inválido'); }

  const authUser = await getUserFromRequest(request);
  if (!authUser || authUser.email !== ADMIN_EMAIL) return fail('No autorizado');

  const { action, apiKey: clientKey, ...params } = body;
  return runLeadFinderAction(action, params, clientKey);
}
