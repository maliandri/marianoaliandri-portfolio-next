export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const SERP = 'https://serpapi.com/search.json';
const KEY  = process.env.SERPAPI_KEY;
// AR-Q (Neuquén provincia) no tiene volumen suficiente para interest over time.
// Usamos AR (Argentina) — las keywords ya incluyen "Neuquén" en el texto,
// así que los datos reflejan búsquedas específicas de la región igual.
const GEO_TRENDS  = 'AR';
const GEO_DAILY   = 'AR-Q'; // trending now sí funciona a nivel provincia

// Grupo 1 — Construcción sustentable & modular (nicho principal)
const KEYWORDS_CONSTRUCCION = [
  'construcción sustentable',
  'casa modular',
  'vivienda prefabricada',
  'arquitecto Neuquén',
  'construcción modular Argentina',
];

// Grupo 2 — Comercio local: tecnología, vehículos, indumentaria
const KEYWORDS_COMERCIO = [
  'venta celulares Neuquén',
  'electrodomésticos Neuquén',
  'concesionaria Neuquén',
  'indumentaria Neuquén',
  'computadoras Neuquén',
];

// Grupo 3 — Petróleo & Vaca Muerta
const KEYWORDS_PETROLEO = [
  'Vaca Muerta',
  'servicios petroleros',
  'oil and gas Argentina',
  'YPF Neuquén',
  'perforación Neuquén',
];

// Grupo 4 — Desarrollo web & servicios digitales (lo que ofrecés)
const KEYWORDS_DIGITAL = [
  'desarrollo web Neuquén',
  'diseño web Neuquén',
  'tienda online Neuquén',
  'posicionamiento web Argentina',
  'marketing digital Neuquén',
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
      fetchTrendingNow(GEO_DAILY),
    ]);

    // 4 créditos — interest over time con geo AR (keywords ya incluyen "Neuquén")
    const interestConstruccion = await fetchInterestOverTime(KEYWORDS_CONSTRUCCION, GEO_TRENDS);
    const interestComercio     = await fetchInterestOverTime(KEYWORDS_COMERCIO,     GEO_TRENDS);
    const interestPetroleo     = await fetchInterestOverTime(KEYWORDS_PETROLEO,     GEO_TRENDS);
    const interestDigital      = await fetchInterestOverTime(KEYWORDS_DIGITAL,      GEO_TRENDS);

    // 2 créditos — related queries
    const relatedConstruccion = await fetchRelatedQueries('construcción sustentable Neuquén', GEO_TRENDS);
    const relatedPetroleo     = await fetchRelatedQueries('servicios petroleros Neuquén',     GEO_TRENDS);

    // Total: ~8 créditos/día × 31 días = 248/mes (dentro del free tier de 250)

    // Datos de interés compartidos (geo AR = Argentina, aplica a ambas vistas)
    const interestData = {
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
    };

    const snapshot = {
      updatedAt: FieldValue.serverTimestamp(),
      date: new Date().toISOString().slice(0, 10),
      neuquen:   { dailyTrends: trendingNQ, ...interestData },
      argentina: { dailyTrends: trendingAR, ...interestData },
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
