export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';
import { google } from 'googleapis';
import { GA4_BOT_CITIES, GA4_PRIVATE_PATH_PREFIXES } from '@/data/ga4Bots';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function unauthorized() {
  return Response.json({ error: 'No autorizado' }, { status: 401 });
}

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return unauthorized();
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) return unauthorized();

    const [noticiasResult, reelsResult, auditoriasResult, presupuestosResult, gscResult, ga4Result] =
      await Promise.allSettled([
        fetchNoticias(),
        fetchReels(),
        fetchAuditorias(),
        fetchPresupuestos(),
        fetchGSC(),
        fetchGA4(),
      ]);

    return Response.json({
      noticias:     noticiasResult.status === 'fulfilled'     ? noticiasResult.value     : null,
      reels:        reelsResult.status === 'fulfilled'        ? reelsResult.value        : null,
      auditorias:   auditoriasResult.status === 'fulfilled'   ? auditoriasResult.value   : null,
      presupuestos: presupuestosResult.status === 'fulfilled' ? presupuestosResult.value : null,
      gsc:          gscResult.status === 'fulfilled'          ? gscResult.value          : null,
      ga4:          ga4Result.status === 'fulfilled'          ? ga4Result.value          : null,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function fetchNoticias() {
  const db = await getDb();
  const snap = await db.collection('noticias').orderBy('publishedAt', 'desc').limit(200).get();
  const docs = snap.docs.map(d => d.data());

  const now = new Date();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  const recientes = docs.filter(d => {
    const ts = d.publishedAt?.toDate ? d.publishedAt.toDate() : new Date(d.publishedAt);
    return ts >= thirtyDaysAgo;
  });

  const porRed = { facebook: 0, instagram: 0, linkedin: 0, x: 0 };
  const porTopico = {};
  const seriePorDia = {};

  // The bot saves `destino` (fb_ig / linkedin / todas / x) but not `networks`.
  // Derive network counts from destino field.
  const DESTINO_NETS = {
    fb_ig:    { facebook: true, instagram: true },
    linkedin: { linkedin: true },
    todas:    { facebook: true, instagram: true, linkedin: true },
    x:        { x: true },
  };

  for (const d of recientes) {
    const nets = d.networks || DESTINO_NETS[d.destino] || DESTINO_NETS.fb_ig;
    if (nets.facebook)  porRed.facebook++;
    if (nets.instagram) porRed.instagram++;
    if (nets.linkedin)  porRed.linkedin++;
    if (nets.x)         porRed.x++;

    const topico = d.topicId || d.topic || 'sin-topico';
    porTopico[topico] = (porTopico[topico] || 0) + 1;

    const ts = d.publishedAt?.toDate ? d.publishedAt.toDate() : new Date(d.publishedAt);
    const dia = ts.toISOString().split('T')[0];
    seriePorDia[dia] = (seriePorDia[dia] || 0) + 1;
  }

  const serie = Object.entries(seriePorDia)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  return { total: docs.length, ultimos30: recientes.length, porRed, porTopico, serie };
}

async function fetchReels() {
  const db = await getDb();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const snap = await db.collection('reels').get();
  const total = snap.size;
  const esteMes = snap.docs.filter(d => {
    const ts = d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(d.data().createdAt);
    return ts >= firstOfMonth;
  }).length;

  return { total, esteMes };
}

async function fetchAuditorias() {
  const db = await getDb();
  const [auditSnap, emailSnap] = await Promise.all([
    db.collection('auditorias').get(),
    db.collection('sent_emails').get(),
  ]);
  const docs = auditSnap.docs.map(d => d.data());

  // Count emails from sent_emails collection (tracked by Resend webhook)
  const emailsEnviados = emailSnap.size;

  let totalNegocios = 0;
  const porCiudad = {};

  for (const d of docs) {
    // stats.total is pre-aggregated at save time; fallback to results array length
    totalNegocios += d.stats?.total ?? (d.results?.length || 0);
    for (const neg of (d.results || [])) {
      const ciudad = neg.ciudad || 'Sin ciudad';
      porCiudad[ciudad] = (porCiudad[ciudad] || 0) + 1;
    }
  }

  return { total: docs.length, emailsEnviados, totalNegocios, porCiudad };
}

async function fetchPresupuestos() {
  const db = await getDb();
  const snap = await db.collection('presupuestos').get();
  const docs = snap.docs.map(d => d.data());

  const pendientes = docs.filter(d => d.estado === 'pending' || !d.estado).length;
  const montoTotal = docs.reduce((sum, d) => sum + (d.montoUSD || 0), 0);

  return { total: docs.length, pendientes, montoTotal };
}

async function fetchGSC() {
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
  start.setDate(start.getDate() - 28);
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
          requestBody: { startDate, endDate, dimensions: ['date'], rowLimit: 30 },
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

async function fetchGA4() {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) return { sesiones: 0, usuarios: 0, paginasVistas: 0, serie: [], noData: true };

  // REST (googleapis) en vez de @google-analytics/data: el cliente gRPC se colgaba.
  const auth = new google.auth.JWT({
    email: process.env.FIREBASE_CLIENT_EMAIL,
    key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth });
  const dateRanges = [{ startDate: '28daysAgo', endDate: 'yesterday' }];
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
