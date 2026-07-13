export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { RUBROS } from '@/data/rubros';

// Consulta el autocompletado de Google (mismo motor que sugiere mientras tipeás).
// client=chrome devuelve google:suggestrelevance → nos sirve para rankear.
// Es un endpoint no oficial pero estable y gratuito. Puede limitar desde IPs
// de datacenter (Vercel); en ese caso el rubro queda con count 0 (degradación suave).
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
    });
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Analiza un rubro en una localidad → devuelve sugerencias reales + score crudo.
async function analyzeRubro(rubro, localidad) {
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

  return {
    ...rubro,
    count: suggestions.length,
    raw,
    suggestions: suggestions.slice(0, 8),
  };
}

// Pool de concurrencia simple para no disparar 65 requests de golpe.
async function runPool(items, worker, concurrency = 6) {
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

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const localidad = (body?.localidad || '').trim();
    if (!localidad) {
      return Response.json({ error: 'Falta la localidad' }, { status: 400 });
    }

    // Permite filtrar por ids de rubro; si no vienen, analiza todos.
    const ids = Array.isArray(body?.rubroIds) && body.rubroIds.length ? new Set(body.rubroIds) : null;
    const target = ids ? RUBROS.filter(r => ids.has(r.id)) : RUBROS;

    const analyzed = await runPool(target, r => analyzeRubro(r, localidad), 6);

    const maxRaw = analyzed.reduce((m, r) => Math.max(m, r.raw), 0) || 1;
    const ranked = analyzed
      .map(r => ({
        id: r.id,
        label: r.label,
        cat: r.cat,
        count: r.count,
        interes: Math.round((r.raw / maxRaw) * 100),
        suggestions: r.suggestions,
      }))
      .sort((a, b) => b.interes - a.interes || b.count - a.count);

    const withData = ranked.filter(r => r.count > 0).length;

    return Response.json({
      localidad,
      provincia: body?.provincia || null,
      total: ranked.length,
      withData,
      results: ranked,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[keyword-explorer] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
