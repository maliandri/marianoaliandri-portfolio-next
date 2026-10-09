import { runLeadFinderAction } from '@/app/api/lead-finder/route';

export const RADIO_M = 15000;

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Audita un lote de negocios de una combinación ciudad × rubro, sin pasar por HTTP ni por el
// navegador. Reutiliza runLeadFinderAction: auditPlace trae caché de 30 días por placeId, así
// que un negocio ya auditado no vuelve a costar una llamada a Google.
export async function runBatch(combo, opts = {}) {
  const {
    budgetMs = 45000, maxSites = 15, maxCandidates = 40, pages = 2,
    run = runLeadFinderAction, now = Date.now, sleep = defaultSleep,
  } = opts;
  const deadline = now() + budgetMs;
  const { ciudad, rubro } = combo;

  // runLeadFinderAction devuelve un Response; se lee su JSON.
  const call = async (action, params) => (await run(action, params)).json();

  const geo = await call('geocode', { city: ciudad, country: 'Argentina' });
  if (!geo.ok) return { results: [], status: 'error', error: geo.error || 'No se pudo geocodificar', examined: 0 };

  const places = [];
  const seen = new Set();
  let pageToken = null;
  for (let page = 0; page < pages; page++) {
    const search = rubro.kind === 'text'
      ? await call('searchText', { lat: geo.lat, lon: geo.lon, query: `${rubro.value}, ${ciudad}`, radiusM: RADIO_M, pageToken })
      : await call('searchNearby', { lat: geo.lat, lon: geo.lon, type: rubro.value, radiusM: RADIO_M, pageToken });
    if (!search.ok) {
      if (!places.length) return { results: [], status: 'error', error: search.error || 'Error de búsqueda', examined: 0 };
      break;
    }
    for (const p of search.places || []) {
      if (!seen.has(p.id)) { seen.add(p.id); places.push(p); }
    }
    pageToken = search.nextPageToken || null;
    if (!pageToken || page === pages - 1) break;
    await sleep(2000); // Google necesita un instante para habilitar el token de la página siguiente
  }

  const results = [];
  let examined = 0;
  let status = 'ok';
  for (const place of places) {
    if (results.length >= maxSites || examined >= maxCandidates || now() >= deadline) break;
    examined++;

    const a = await call('auditPlace', { placeId: place.id });
    if (!a.ok) {
      if (a.code === 'QUOTA_EXCEEDED') { status = 'cuota_agotada'; break; }
      continue;
    }
    if (!a.hasWebsite || typeof a.seoScore !== 'number') continue;

    results.push({
      id:           place.id,
      nombre:       place.displayName?.text || 'Sin nombre',
      ciudad,
      tipo:         rubro.label,
      rubro:        rubro.label,
      aptoSistemaMedida: rubro.prioritario === true,
      lat:          place.location?.latitude ?? null,
      lon:          place.location?.longitude ?? null,
      siteUrl:      a.siteUrl,
      email:        a.email || null,
      seoScore:     a.seoScore,
      hasSitemap:   a.hasSitemap,
      hasRobots:    a.hasRobots,
      metaDesc:     a.metaDesc,
      hasOG:        a.hasOG,
      lastModified: a.lastUpdated || a.lastModified || null,
      rating:       a.rating ?? null,
    });
  }

  return { results, status, examined };
}
