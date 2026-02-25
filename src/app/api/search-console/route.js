export const dynamic = 'force-dynamic';
import { google } from 'googleapis';

const SITES = [
  'sc-domain:almamod.com.ar',
  'sc-domain:aluminehogar.com.ar',
  'sc-domain:marianoaliandri.com.ar',
  'sc-domain:totalproteccion.com.ar',
];
const SITE_NAMES = {
  'sc-domain:almamod.com.ar': 'almamod.com.ar',
  'sc-domain:aluminehogar.com.ar': 'aluminehogar.com.ar',
  'sc-domain:marianoaliandri.com.ar': 'marianoaliandri.com.ar',
  'sc-domain:totalproteccion.com.ar': 'totalproteccion.com.ar',
};

function getAuth() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GSC_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || process.env.GSC_PRIVATE_KEY)?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) throw new Error('Credenciales de service account no configuradas');
  return new google.auth.JWT(clientEmail, null, privateKey, ['https://www.googleapis.com/auth/webmasters.readonly']);
}

function getDateRange(days = 28) {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
}

async function fetchSiteData(searchconsole, siteUrl, dateRange) {
  try {
    const [totalsRes, queriesRes, pagesRes] = await Promise.all([
      searchconsole.searchanalytics.query({ siteUrl, requestBody: { startDate: dateRange.startDate, endDate: dateRange.endDate, dimensions: [], rowLimit: 1 } }),
      searchconsole.searchanalytics.query({ siteUrl, requestBody: { startDate: dateRange.startDate, endDate: dateRange.endDate, dimensions: ['query'], rowLimit: 5, orderBy: 'clicks', orderDirection: 'descending' } }),
      searchconsole.searchanalytics.query({ siteUrl, requestBody: { startDate: dateRange.startDate, endDate: dateRange.endDate, dimensions: ['page'], rowLimit: 5, orderBy: 'clicks', orderDirection: 'descending' } }),
    ]);
    const totals = totalsRes.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    const topQueries = (queriesRes.data.rows || []).map(r => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: Math.round(r.ctr * 1000) / 10, position: Math.round(r.position * 10) / 10 }));
    const topPages = (pagesRes.data.rows || []).map(r => ({ page: r.keys[0].replace(/^https?:\/\/[^/]+/, ''), clicks: r.clicks, impressions: r.impressions }));
    return {
      siteUrl: SITE_NAMES[siteUrl] || siteUrl,
      totals: { clicks: totals.clicks || 0, impressions: totals.impressions || 0, ctr: Math.round((totals.ctr || 0) * 1000) / 10, position: Math.round((totals.position || 0) * 10) / 10 },
      topQueries, topPages,
    };
  } catch (error) {
    return { siteUrl: SITE_NAMES[siteUrl] || siteUrl, totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, topQueries: [], topPages: [], error: error.message };
  }
}

export async function POST(request) {
  try {
    const { days = 28 } = await request.json();
    const auth = getAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });
    const dateRange = getDateRange(days);
    const results = await Promise.all(SITES.map(site => fetchSiteData(searchconsole, site, dateRange)));

    const aggregated = results.reduce((acc, site) => ({
      totalClicks: acc.totalClicks + site.totals.clicks,
      totalImpressions: acc.totalImpressions + site.totals.impressions,
    }), { totalClicks: 0, totalImpressions: 0 });

    aggregated.averageCTR = aggregated.totalImpressions > 0 ? Math.round((aggregated.totalClicks / aggregated.totalImpressions) * 1000) / 10 : 0;
    const totalPositionWeight = results.reduce((sum, site) => sum + (site.totals.position * site.totals.impressions), 0);
    aggregated.averagePosition = aggregated.totalImpressions > 0 ? Math.round((totalPositionWeight / aggregated.totalImpressions) * 10) / 10 : 0;

    return Response.json({ success: true, data: { sites: results, aggregated, period: { startDate: dateRange.startDate, endDate: dateRange.endDate, days } } });
  } catch (error) {
    return Response.json({ error: 'Error consultando Search Console', details: error.message }, { status: 500 });
  }
}
