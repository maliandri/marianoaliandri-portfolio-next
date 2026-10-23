// Demanda de búsqueda por rubro en una localidad, vía el autocompletado de Google (gratis,
// no oficial). Lo usan /api/keyword-explorer (producto "Rubros buscados") y el Lead Finder
// (acción 'rubroDemand' de /api/lead-finder-pro/run) para cruzar demanda con negocios.
import { RUBROS } from '@/data/rubros';

// client=chrome devuelve google:suggestrelevance → nos sirve para rankear. Puede limitar desde
// IPs de datacenter (Vercel); en ese caso el rubro queda con count 0 (degradación suave).
const SUGGEST_URL = 'https://suggestqueries.google.com/complete/search';

async function fetchSuggest(query) {
  const url = `${SUGGEST_URL}?client=chrome&hl=es&gl=ar&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
      // Sin cache: el interés puede cambiar y no queremos respuestas viejas
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return JSON.parse(await res.text());
  } catch {
    return null;
  }
}

// Analiza un rubro (o un término libre: { id, label }) en una localidad → sugerencias reales + score crudo.
export async function analyzeRubro(rubro, localidad) {
  const query = `${rubro.label} ${localidad}`.trim();
  const data = await fetchSuggest(query);

  if (!Array.isArray(data)) {
    return { ...rubro, count: 0, raw: 0, suggestions: [], error: true };
  }

  const suggestions = Array.isArray(data[1]) ? data[1] : [];
  const meta = data[4] && typeof data[4] === 'object' ? data[4] : {};
  const relevances = Array.isArray(meta['google:suggestrelevance'])
    ? meta['google:suggestrelevance']
    : [];

  const relSum = relevances.reduce((a, b) => a + (Number(b) || 0), 0);

  // Score crudo: la cantidad de sugerencias (amplitud de la demanda) pesa fuerte,
  // + la relevancia acumulada como desempate fino.
  const raw = suggestions.length * 1000 + relSum;

  return { ...rubro, count: suggestions.length, raw, suggestions: suggestions.slice(0, 8) };
}

// Pool de concurrencia simple para no disparar 65 requests de golpe.
export async function runPool(items, worker, concurrency = 6) {
  const results = new Array(items.length);
  let i = 0;
  async function next() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, next));
  return results;
}

// interes 0–100 relativo a `maxRaw` (el rubro más buscado de la localidad = 100).
export function rankAnalyzed(analyzed, maxRaw = analyzed.reduce((m, r) => Math.max(m, r.raw), 0) || 1) {
  return analyzed
    .map(r => ({
      id: r.id,
      label: r.label,
      cat: r.cat,
      count: r.count,
      interes: Math.min(100, Math.round((r.raw / maxRaw) * 100)),
      suggestions: r.suggestions,
    }))
    .sort((a, b) => b.interes - a.interes || b.count - a.count);
}

export const analyzeAll = (localidad, rubros = RUBROS) => runPool(rubros, r => analyzeRubro(r, localidad), 6);

// ── Cruce con el Lead Finder ────────────────────────────────────────────────

const CACHE_COLLECTION = 'rubro_demanda';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // la demanda de un rubro no cambia de un día al otro
export const MAX_TERMINOS = 10;

export const localidadKey = (localidad) => String(localidad || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);

// "Neuquén, Argentina" → "Neuquén": el autocompletado responde mejor con la ciudad sola.
export const ciudadDe = (zona) => String(zona || '').split(',')[0].trim();

// Demanda de todos los rubros (con caché de 7 días en Firestore) + términos libres,
// normalizados contra el mismo máximo para que sean comparables.
export async function demandaParaLeads(db, localidad, terminos = []) {
  const ciudad = ciudadDe(localidad);
  const key = localidadKey(ciudad);
  if (!key) throw new Error('Localidad inválida');

  const ref = db ? db.collection(CACHE_COLLECTION).doc(key) : null;
  let analyzed = null;
  if (ref) {
    try {
      const snap = await ref.get();
      if (snap.exists && Date.now() - (snap.data().checkedAt || 0) < CACHE_TTL_MS) analyzed = snap.data().analyzed;
    } catch { /* sin caché, se analiza igual */ }
  }
  if (!analyzed) {
    analyzed = (await analyzeAll(ciudad)).map(({ id, label, cat, count, raw, suggestions, error }) =>
      ({ id, label, cat, count, raw, suggestions, ...(error ? { error: true } : {}) }));
    // Solo se cachea si Google respondió algo (si nos limitó, todo vino en 0).
    if (ref && analyzed.some(r => r.count > 0)) {
      await ref.set({ ciudad, analyzed, checkedAt: Date.now() }).catch(() => {});
    }
  }

  const maxRaw = analyzed.reduce((m, r) => Math.max(m, r.raw), 0) || 1;
  const terms = [...new Set(terminos.map(t => String(t).trim()).filter(Boolean))].slice(0, MAX_TERMINOS);
  const analyzedTerms = await runPool(terms.map(t => ({ id: t, label: t })), r => analyzeRubro(r, ciudad), 5);

  const porRubro = Object.fromEntries(rankAnalyzed(analyzed, maxRaw).map(r => [r.id, resumen(r)]));
  const porTermino = Object.fromEntries(rankAnalyzed(analyzedTerms, maxRaw).map(r => [r.id, resumen(r)]));
  const top = rankAnalyzed(analyzed, maxRaw).filter(r => r.count > 0).slice(0, 10).map(r => ({ id: r.id, label: r.label, ...resumen(r) }));

  return { ciudad, top, porRubro, porTermino };
}

// Lo que viaja al cliente por rubro: puntaje y hasta 3 frases reales (no la lista completa,
// que es lo que vende el producto "Rubros buscados").
function resumen(r) {
  return { interes: r.interes, ejemplos: (r.suggestions || []).slice(0, 3) };
}

// Oportunidad de un lead: mucha demanda en su rubro y poca presencia web (sin web = 0).
export function oportunidad(lead) {
  const interes = lead?.demanda?.interes;
  if (typeof interes !== 'number') return -1;
  const seo = lead.siteUrl ? (typeof lead.seoScore === 'number' ? lead.seoScore : 50) : 0;
  return Math.round(interes * (100 - seo) / 100);
}
