export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const SERP = 'https://serpapi.com/search.json';
const KEY  = process.env.SERPAPI_KEY;

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

async function fetchTrendingNow(geo) {
  try {
    const url = `${SERP}?engine=google_trends_trending_now&geo=${geo}&hl=es&api_key=${KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    const items = data?.trending_searches || [];
    return items.slice(0, 15).map(t => ({
      title:          t.query || '',
      traffic:        t.search_volume ? `${(t.search_volume / 1000).toFixed(0)}K+` : '',
      relatedQueries: (t.related_queries || []).slice(0, 4),
    }));
  } catch { return []; }
}

async function fetchInterestOverTime(keywords, geo) {
  try {
    const q   = keywords.slice(0, 5).join(',');
    const url = `${SERP}?engine=google_trends&q=${encodeURIComponent(q)}&geo=${geo}&date=today+3-m&hl=es&api_key=${KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    const timeline = data?.interest_over_time?.timeline_data || [];
    return timeline.map(p => ({
      date:   p.date?.slice(0, 10) || '',
      values: p.values?.map(v => v.extracted_value ?? 0) || [],
    }));
  } catch { return []; }
}

async function fetchRelatedQueries(keyword, geo) {
  try {
    const url = `${SERP}?engine=google_trends&q=${encodeURIComponent(keyword)}&geo=${geo}&data_type=RELATED_QUERIES&hl=es&api_key=${KEY}`;
    const res  = await fetch(url);
    const data = await res.json();
    const rising = data?.related_queries?.rising  || [];
    const top    = data?.related_queries?.top     || [];
    return {
      rising: rising.slice(0, 10).map(k => ({ query: k.query, value: k.extracted_value ?? 0 })),
      top:    top.slice(0, 10).map(k => ({ query: k.query, value: k.extracted_value ?? 0 })),
    };
  } catch { return { rising: [], top: [] }; }
}

export async function GET(request) {
  // Vercel Cron o llamada manual con CRON_SECRET
  const auth = request.headers.get('authorization');
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';
  if (!isVercelCron && process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return handler();
}

async function handler() {
  if (!KEY) return Response.json({ error: 'SERPAPI_KEY no configurada' }, { status: 500 });

  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    // Trending now para ambas regiones (2 créditos)
    const [neuquenTrends, argentinaTrends] = await Promise.all([
      fetchTrendingNow('AR-Q'),
      fetchTrendingNow('AR'),
    ]);

    // Interest over time — 4 créditos (2 keyword groups × 2 regiones)
    const interestComerciosNQ = await fetchInterestOverTime(BUSINESS_KEYWORDS, 'AR-Q');
    const interestComerciosAR = await fetchInterestOverTime(BUSINESS_KEYWORDS, 'AR');
    const interestTrendsNQ    = await fetchInterestOverTime(TREND_KEYWORDS, 'AR-Q');
    const interestTrendsAR    = await fetchInterestOverTime(TREND_KEYWORDS, 'AR');

    // Related queries — 2 créditos
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

    console.log('[analitica/refresh] ok —', new Date().toISOString(),
      'NQ:', neuquenTrends.length, 'AR:', argentinaTrends.length);

    return Response.json({
      success: true,
      date: snapshot.date,
      neuquenTrends: neuquenTrends.length,
      argentinaTrends: argentinaTrends.length,
      creditsUsed: 8,
    });

  } catch (e) {
    console.error('[analitica/refresh] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
