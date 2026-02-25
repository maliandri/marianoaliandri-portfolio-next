import { google } from 'googleapis';

const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// Propiedades de dominio en Search Console
const SITES = [
  'sc-domain:almamod.com.ar',
  'sc-domain:aluminehogar.com.ar',
  'sc-domain:marianoaliandri.com.ar',
  'sc-domain:totalproteccion.com.ar'
];

// Nombres legibles para cada dominio
const SITE_NAMES = {
  'sc-domain:almamod.com.ar': 'almamod.com.ar',
  'sc-domain:aluminehogar.com.ar': 'aluminehogar.com.ar',
  'sc-domain:marianoaliandri.com.ar': 'marianoaliandri.com.ar',
  'sc-domain:totalproteccion.com.ar': 'totalproteccion.com.ar'
};

function getAuth() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GSC_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.GSC_PRIVATE_KEY)?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Credenciales de service account no configuradas');
  }

  return new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    ['https://www.googleapis.com/auth/webmasters.readonly']
  );
}

function getDateRange(days = 28) {
  const end = new Date();
  end.setDate(end.getDate() - 3); // GSC tiene 3 días de delay
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

async function fetchSiteData(searchconsole, siteUrl, dateRange) {
  try {
    // Obtener totales del sitio
    const totalsResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        dimensions: [],
        rowLimit: 1
      }
    });

    const totals = totalsResponse.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };

    // Obtener top queries
    const queriesResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        dimensions: ['query'],
        rowLimit: 5,
        orderBy: 'clicks',
        orderDirection: 'descending'
      }
    });

    const topQueries = (queriesResponse.data.rows || []).map(row => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Math.round(row.ctr * 1000) / 10,
      position: Math.round(row.position * 10) / 10
    }));

    // Obtener top pages
    const pagesResponse = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        dimensions: ['page'],
        rowLimit: 5,
        orderBy: 'clicks',
        orderDirection: 'descending'
      }
    });

    const topPages = (pagesResponse.data.rows || []).map(row => ({
      page: row.keys[0].replace(/^https?:\/\/[^/]+/, ''),
      clicks: row.clicks,
      impressions: row.impressions
    }));

    return {
      siteUrl: SITE_NAMES[siteUrl] || siteUrl,
      totals: {
        clicks: totals.clicks || 0,
        impressions: totals.impressions || 0,
        ctr: Math.round((totals.ctr || 0) * 1000) / 10,
        position: Math.round((totals.position || 0) * 10) / 10
      },
      topQueries,
      topPages
    };
  } catch (error) {
    console.error(`Error fetching data for ${siteUrl}:`, error.message);
    return {
      siteUrl: SITE_NAMES[siteUrl] || siteUrl,
      totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      topQueries: [],
      topPages: [],
      error: error.message
    };
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: responseHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: responseHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { days = 28 } = JSON.parse(event.body || '{}');
    const auth = getAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });
    const dateRange = getDateRange(days);

    console.log(`Consultando Search Console: ${SITES.length} sitios, ${days} días (${dateRange.startDate} a ${dateRange.endDate})`);

    // Consultar todos los sitios en paralelo
    const results = await Promise.all(
      SITES.map(site => fetchSiteData(searchconsole, site, dateRange))
    );

    // Calcular agregados
    const aggregated = results.reduce((acc, site) => ({
      totalClicks: acc.totalClicks + site.totals.clicks,
      totalImpressions: acc.totalImpressions + site.totals.impressions,
    }), { totalClicks: 0, totalImpressions: 0 });

    aggregated.averageCTR = aggregated.totalImpressions > 0
      ? Math.round((aggregated.totalClicks / aggregated.totalImpressions) * 1000) / 10
      : 0;

    const totalPositionWeight = results.reduce((sum, site) => sum + (site.totals.position * site.totals.impressions), 0);
    aggregated.averagePosition = aggregated.totalImpressions > 0
      ? Math.round((totalPositionWeight / aggregated.totalImpressions) * 10) / 10
      : 0;

    console.log(`Search Console OK: ${aggregated.totalClicks} clicks, ${aggregated.totalImpressions} impresiones`);

    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          sites: results,
          aggregated,
          period: { startDate: dateRange.startDate, endDate: dateRange.endDate, days }
        }
      })
    };
  } catch (error) {
    console.error('Error en search-console:', error.message);
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ error: 'Error consultando Search Console', details: error.message })
    };
  }
}
