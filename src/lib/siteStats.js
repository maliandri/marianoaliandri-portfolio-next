import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';
import { google } from 'googleapis';
import { GA4_BOT_CITIES, GA4_PRIVATE_PATH_PREFIXES } from '@/data/ga4Bots';

// Search Console + GA4 del portfolio. Lo usan /api/dashboard-stats (admin) y el servidor MCP.

export async function fetchGSC({ days = 28 } = {}) {
  const auth = getGSCAuth();
  const searchconsole = google.searchconsole({ version: 'v1', auth });
  // Query the portfolio site directly — try sc-domain first, then URL-prefix
  const PORTFOLIO_SITE_CANDIDATES = [
    'sc-domain:marianoaliandri.com.ar',
    'https://marianoaliandri.com.ar/',
    'https://www.marianoaliandri.com.ar/',
  ];
  // Verify which siteUrl actually exists in the account
  let portfolioSiteUrl = null;
  try {
    const allSites = await getVerifiedSites(auth);
    const match = allSites.find(s =>
      s.domain === 'marianoaliandri.com.ar' ||
      PORTFOLIO_SITE_CANDIDATES.includes(s.siteUrl)
    );
    portfolioSiteUrl = match?.siteUrl || PORTFOLIO_SITE_CANDIDATES[0];
  } catch {
    portfolioSiteUrl = PORTFOLIO_SITE_CANDIDATES[0];
  }
  const sites = [{ siteUrl: portfolioSiteUrl }];

  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  let totalClicks = 0, totalImpressions = 0, posicionSum = 0, posicionCount = 0;
  const seriePorDia = {};

  await Promise.allSettled(sites.map(async (site) => {
    try {
      const [totals, serie] = await Promise.all([
        searchconsole.searchanalytics.query({
          siteUrl: site.siteUrl,
          requestBody: { startDate, endDate, dimensions: [], rowLimit: 1 },
        }),
        searchconsole.searchanalytics.query({
          siteUrl: site.siteUrl,
          requestBody: { startDate, endDate, dimensions: ['date'], rowLimit: Math.max(30, days + 5) },
        }),
      ]);
      const row = totals.data.rows?.[0];
      if (row) {
        totalClicks += row.clicks || 0;
        totalImpressions += row.impressions || 0;
        posicionSum += row.position || 0;
        posicionCount++;
      }
      for (const r of serie.data.rows || []) {
        const dia = r.keys[0];
        if (!seriePorDia[dia]) seriePorDia[dia] = { clicks: 0, impressions: 0 };
        seriePorDia[dia].clicks += r.clicks || 0;
        seriePorDia[dia].impressions += r.impressions || 0;
      }
    } catch { /* skip failing site */ }
  }));

  const serieArr = Object.entries(seriePorDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  return {
    clicks: totalClicks,
    impresiones: totalImpressions,
    posicion: posicionCount ? Math.round((posicionSum / posicionCount) * 10) / 10 : 0,
    serie: serieArr,
  };
}

// Sesiones que NO vienen de un data center (ver src/data/ga4Bots.js).
const SIN_BOTS = {
  notExpression: {
    filter: { fieldName: 'city', inListFilter: { values: GA4_BOT_CITIES } },
  },
};

const SIN_BOTS_NI_PRIVADAS = {
  andGroup: {
    expressions: [
      SIN_BOTS,
      ...GA4_PRIVATE_PATH_PREFIXES.map(prefix => ({
        notExpression: {
          filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: prefix } },
        },
      })),
    ],
  },
};

function ga4Client() {
  const auth = new google.auth.JWT({
    email: process.env.FIREBASE_CLIENT_EMAIL,
    key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  return google.analyticsdata({ version: 'v1beta', auth });
}

// Un paso de embudo → filtro de GA4: personas (sin bots) que dispararon el evento (o vieron la
// página) en las páginas indicadas. Una consulta por paso para no sumar dos veces a quien vio varias
// páginas del mismo prefijo.
export function stepFilter({ event, page }) {
  const exprs = [SIN_BOTS, { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: event || 'page_view' } } }];
  const pages = [page].flat().filter(Boolean);
  if (pages.length) {
    exprs.push({
      orGroup: {
        expressions: pages.map(p => ({ filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: p } } })),
      },
    });
  }
  return { andGroup: { expressions: exprs } };
}

// Arma los embudos con las personas por paso y el % respecto del paso anterior y del primero.
export function assembleFunnels(funnels, counts) {
  return funnels.map((f, fi) => {
    const pasos = f.pasos.map((p, pi) => ({ label: p.label, personas: counts[`f${fi}_${pi}`] ?? 0 }));
    pasos.forEach((p, i) => {
      const prev = i ? pasos[i - 1].personas : null;
      p.pctPrevio = prev ? Math.round((p.personas / prev) * 100) : null;
      p.pctInicio = i && pasos[0].personas ? Math.round((p.personas / pasos[0].personas) * 100) : null;
    });
    return { id: f.id, titulo: f.titulo, pasos };
  });
}

export async function fetchFunnels({ days = 28, funnels, contacts = [] } = {}) {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) return { dias: days, embudos: [], contactos: [], noData: true };

  const queries = [
    ...funnels.flatMap((f, fi) => f.pasos.map((p, pi) => ({ key: `f${fi}_${pi}`, step: p }))),
    ...contacts.map((c, ci) => ({ key: `c${ci}`, step: { event: c.event } })),
  ];
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }];
  const analyticsdata = ga4Client();

  // batchRunReports acepta hasta 5 reportes por pedido.
  const chunks = [];
  for (let i = 0; i < queries.length; i += 5) chunks.push(queries.slice(i, i + 5));
  const responses = await Promise.all(chunks.map(chunk => analyticsdata.properties.batchRunReports({
    property: `properties/${propertyId}`,
    requestBody: {
      requests: chunk.map(q => ({ dateRanges, dimensionFilter: stepFilter(q.step), metrics: [{ name: 'activeUsers' }] })),
    },
  })));

  const counts = {};
  responses.forEach((r, ci) => (r.data.reports || []).forEach((rep, i) => {
    counts[chunks[ci][i].key] = parseInt(rep.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
  }));

  return {
    dias: days,
    embudos: assembleFunnels(funnels, counts),
    contactos: contacts.map((c, ci) => ({ event: c.event, label: c.label, personas: counts[`c${ci}`] ?? 0 })),
  };
}

export async function fetchGA4({ days = 28 } = {}) {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) return { sesiones: 0, usuarios: 0, paginasVistas: 0, serie: [], noData: true };

  // REST (googleapis) en vez de @google-analytics/data: el cliente gRPC se colgaba.
  const analyticsdata = ga4Client();
  const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'yesterday' }];
  const byMetric = metricName => [{ metric: { metricName }, desc: true }];

  const { data } = await analyticsdata.properties.batchRunReports({
    property: `properties/${propertyId}`,
    requestBody: {
      requests: [
        // 0: serie diaria, solo personas
        {
          dateRanges, dimensionFilter: SIN_BOTS,
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
          metricAggregations: ['TOTAL'], // totales deduplicados (un usuario que vuelve cuenta 1)
        },
        // 1: totales con bots incluidos
        { dateRanges, metrics: [{ name: 'activeUsers' }] },
        // 2: páginas públicas más vistas
        {
          dateRanges, dimensionFilter: SIN_BOTS_NI_PRIVADAS,
          dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
          orderBys: byMetric('screenPageViews'), limit: 10,
        },
        // 3: de dónde llegan
        {
          dateRanges, dimensionFilter: SIN_BOTS,
          dimensions: [{ name: 'sessionSourceMedium' }],
          metrics: [{ name: 'sessions' }],
          orderBys: byMetric('sessions'), limit: 8,
        },
        // 4: ciudades
        {
          dateRanges, dimensionFilter: SIN_BOTS,
          dimensions: [{ name: 'city' }],
          metrics: [{ name: 'activeUsers' }],
          orderBys: byMetric('activeUsers'), limit: 8,
        },
      ],
    },
  });

  const [serieRep, totalRep, paginasRep, fuentesRep, ciudadesRep] = data.reports || [];
  const num = v => parseInt(v || '0', 10);

  const usuariosTotales = num(totalRep?.rows?.[0]?.metricValues?.[0]?.value);
  const paginas = (paginasRep?.rows || []).map(r => ({
    path: r.dimensionValues[0].value,
    titulo: r.dimensionValues[1].value,
    vistas: num(r.metricValues[0].value),
    usuarios: num(r.metricValues[1].value),
  }));
  const fuentes = (fuentesRep?.rows || []).map(r => ({
    fuente: r.dimensionValues[0].value,
    sesiones: num(r.metricValues[0].value),
  }));
  const ciudades = (ciudadesRep?.rows || []).map(r => ({
    ciudad: r.dimensionValues[0].value,
    usuarios: num(r.metricValues[0].value),
  }));

  const totales = serieRep?.totals?.[0]?.metricValues || [];
  const sesiones = num(totales[0]?.value);
  const usuarios = num(totales[1]?.value);
  const paginasVistas = num(totales[2]?.value);
  const bots = Math.max(0, usuariosTotales - usuarios);

  const serie = (serieRep?.rows || []).map(row => {
    const date = row.dimensionValues[0].value;
    // GA4 date is YYYYMMDD → YYYY-MM-DD
    return {
      date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
      sesiones: num(row.metricValues[0].value),
      usuarios: num(row.metricValues[1].value),
    };
  });
  serie.sort((a, b) => a.date.localeCompare(b.date));
  return { sesiones, usuarios, paginasVistas, bots, serie, paginas, fuentes, ciudades };
}
