export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const SERP = 'https://serpapi.com/search.json';
const KEY  = process.env.SERPAPI_KEY;
const GEO  = 'AR-Q'; // Neuquén provincia

// Grupo 1 — Construcción, arquitectura y diseño
const KEYWORDS_CONSTRUCCION = [
  'arquitecto Neuquén',
  'constructora Neuquén',
  'construcción sustentable Neuquén',
  'muebles a medida Neuquén',
  'diseño de interiores Neuquén',
];

// Grupo 2 — Comercio local: tecnología, vehículos, indumentaria
const KEYWORDS_COMERCIO = [
  'venta celulares Neuquén',
  'electrodomésticos Neuquén',
  'concesionaria autos Neuquén',
  'indumentaria Neuquén',
  'informática Neuquén',
];

// Grupo 3 — Petróleo, Vaca Muerta y servicios industriales
const KEYWORDS_PETROLEO = [
  'Vaca Muerta',
  'servicios petroleros Neuquén',
  'proveedores oil gas Neuquén',
  'empresa servicios Neuquén',
  'licitaciones Neuquén',
];

// Grupo 4 — Servicios digitales (lo que vos ofrecés)
const KEYWORDS_DIGITAL = [
  'diseño web Neuquén',
  'marketing digital Neuquén',
  'posicionamiento web Neuquén',
  'tienda online Neuquén',
  'redes sociales empresa Neuquén',
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
    const rising = data?.related_queries?.rising || [];
    const top    = data?.related_queries?.top    || [];
    return {
      rising: rising.slice(0, 10).map(k => ({ query: k.query, value: k.extracted_value ?? 0 })),
      top:    top.slice(0, 10).map(k => ({ query: k.query, value: k.extracted_value ?? 0 })),
    };
  } catch { return { rising: [], top: [] }; }
}

export async function GET() {
  return handler();
}

async function handler() {
  if (!KEY) return Response.json({ error: 'SERPAPI_KEY no configurada' }, { status: 500 });

  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    // 2 créditos — trending now AR + NQ
    const [trendingAR, trendingNQ] = await Promise.all([
      fetchTrendingNow('AR'),
      fetchTrendingNow(GEO),
    ]);

    // 4 créditos — interest over time por grupo temático (solo Neuquén)
    const interestConstruccion = await fetchInterestOverTime(KEYWORDS_CONSTRUCCION, GEO);
    const interestComercio     = await fetchInterestOverTime(KEYWORDS_COMERCIO, GEO);
    const interestPetroleo     = await fetchInterestOverTime(KEYWORDS_PETROLEO, GEO);
    const interestDigital      = await fetchInterestOverTime(KEYWORDS_DIGITAL, GEO);

    // 2 créditos — related queries para los rubros más estratégicos
    const relatedConstruccion = await fetchRelatedQueries('construcción sustentable Neuquén', GEO);
    const relatedPetroleo     = await fetchRelatedQueries('servicios petroleros Neuquén', GEO);

    // Total: ~8 créditos/día × 31 días = 248/mes (dentro del free tier de 250)

    const snapshot = {
      updatedAt: FieldValue.serverTimestamp(),
      date: new Date().toISOString().slice(0, 10),
      neuquen: {
        dailyTrends:          trendingNQ,
        interestConstruccion,
        interestComercio,
        interestPetroleo,
        interestDigital,
        relatedConstruccion,
        relatedPetroleo,
        keywordsConstruccion: KEYWORDS_CONSTRUCCION,
        keywordsComercio:     KEYWORDS_COMERCIO,
        keywordsPetroleo:     KEYWORDS_PETROLEO,
        keywordsDigital:      KEYWORDS_DIGITAL,
      },
      argentina: {
        dailyTrends: trendingAR,
      },
    };

    await db.collection('analytics_cache').doc('trends').set(snapshot);

    console.log('[analitica/refresh] ok —', new Date().toISOString());
    return Response.json({
      success: true,
      date: snapshot.date,
      construccion: interestConstruccion.length,
      comercio:     interestComercio.length,
      petroleo:     interestPetroleo.length,
      digital:      interestDigital.length,
      creditsUsed:  8,
    });

  } catch (e) {
    console.error('[analitica/refresh] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
