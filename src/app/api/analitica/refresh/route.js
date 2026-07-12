export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import googleTrends from 'google-trends-api';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Zooms: Neuquén → Patagonia → Argentina
const REGIONS = [
  { id: 'neuquen',   geo: 'AR-Q', label: 'Neuquén' },
  { id: 'patagonia', geo: 'AR',   label: 'Argentina', keywords: ['Neuquén','Río Negro','Chubut','Santa Cruz','Tierra del Fuego'] },
  { id: 'argentina', geo: 'AR',   label: 'Argentina' },
];

// Keywords orgánicas de comercios — primera dimensión
const BUSINESS_KEYWORDS = [
  'restaurante Neuquén', 'taller mecánico Neuquén', 'dentista Neuquén',
  'peluquería Neuquén', 'inmobiliaria Neuquén',
];

// Términos de búsqueda de trends — segunda dimensión
const TREND_KEYWORDS = [
  'construcción sustentable', 'marketing digital Patagonia',
  'diseño web Neuquén', 'turismo Neuquén', 'emprendimientos Patagonia',
];

async function fetchDailyTrends(geo) {
  try {
    const raw = await googleTrends.dailyTrends({ trendDate: new Date(), geo, hl: 'es-AR' });
    const parsed = JSON.parse(raw);
    const items = parsed?.default?.trendingSearchesDays?.[0]?.trendingSearches || [];
    return items.slice(0, 15).map(t => ({
      title:         t.title?.query || '',
      traffic:       t.formattedTraffic || '',
      articles:      (t.articles || []).slice(0, 2).map(a => ({ title: a.title, source: a.source?.name, url: a.url })),
      relatedQueries: (t.relatedQueries || []).map(q => q.query),
      image:         t.image?.imageUrl || null,
    }));
  } catch { return []; }
}

async function fetchInterestOverTime(keywords, geo) {
  try {
    const raw = await googleTrends.interestOverTime({
      keyword: keywords.slice(0, 5),
      startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 días
      geo,
      hl: 'es-AR',
    });
    const parsed = JSON.parse(raw);
    const timeline = parsed?.default?.timelineData || [];
    return timeline.map(p => ({
      date:   new Date(parseInt(p.time) * 1000).toISOString().slice(0, 10),
      values: p.value,
    }));
  } catch { return []; }
}

async function fetchRelatedQueries(keyword, geo) {
  try {
    const raw = await googleTrends.relatedQueries({ keyword, geo, hl: 'es-AR' });
    const parsed = JSON.parse(raw);
    const rising = parsed?.default?.rankedList?.[0]?.rankedKeyword?.slice(0, 10) || [];
    const top    = parsed?.default?.rankedList?.[1]?.rankedKeyword?.slice(0, 10) || [];
    return {
      rising: rising.map(k => ({ query: k.query, value: k.value })),
      top:    top.map(k => ({ query: k.query, value: k.value })),
    };
  } catch { return { rising: [], top: [] }; }
}

export async function GET() {
  return handler();
}

export async function POST(request) {
  // Llamada manual desde el admin
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return handler();
}

async function handler() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const [neuquenTrends, argentinaTrends] = await Promise.all([
      fetchDailyTrends('AR-Q'),
      fetchDailyTrends('AR'),
    ]);

    // Primera dimensión: keywords orgánicas de comercios
    const interestComerciosNQ = await fetchInterestOverTime(BUSINESS_KEYWORDS, 'AR-Q');
    const interestComerciosAR = await fetchInterestOverTime(BUSINESS_KEYWORDS, 'AR');

    // Segunda dimensión: tendencias relacionadas con esos rubros
    const interestTrendsNQ = await fetchInterestOverTime(TREND_KEYWORDS, 'AR-Q');
    const interestTrendsAR = await fetchInterestOverTime(TREND_KEYWORDS, 'AR');

    // Related queries para el rubro más buscado
    const relatedNeuquen = await fetchRelatedQueries('restaurante Neuquén', 'AR-Q');
    const relatedAR      = await fetchRelatedQueries('diseño web Argentina', 'AR');

    const snapshot = {
      updatedAt: FieldValue.serverTimestamp(),
      date: new Date().toISOString().slice(0, 10),
      neuquen: {
        dailyTrends:       neuquenTrends,
        interestComercios: interestComerciosNQ,
        interestTrends:    interestTrendsNQ,
        relatedQueries:    relatedNeuquen,
        keywordsComercios: BUSINESS_KEYWORDS,
        keywordsTrends:    TREND_KEYWORDS,
      },
      argentina: {
        dailyTrends:       argentinaTrends,
        interestComercios: interestComerciosAR,
        interestTrends:    interestTrendsAR,
        relatedQueries:    relatedAR,
        keywordsComercios: BUSINESS_KEYWORDS,
        keywordsTrends:    TREND_KEYWORDS,
      },
    };

    await db.collection('analytics_cache').doc('trends').set(snapshot);

    console.log('[analitica/refresh] snapshot guardado:', new Date().toISOString());
    return Response.json({ success: true, date: snapshot.date, neuquenTrends: neuquenTrends.length, argentinaTrends: argentinaTrends.length });

  } catch (e) {
    console.error('[analitica/refresh] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
