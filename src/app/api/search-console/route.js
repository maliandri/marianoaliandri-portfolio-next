export const dynamic = 'force-dynamic';

import { google } from 'googleapis';
import { getGSCAuth, getVerifiedSites } from '@/lib/gscClient';

function getDateRange(days = 28) {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
}

async function fetchSiteData(searchconsole, site, dateRange) {
  try {
    const [totalsRes, queriesRes, pagesRes] = await Promise.all([
      searchconsole.searchanalytics.query({ siteUrl: site.siteUrl, requestBody: { startDate: dateRange.startDate, endDate: dateRange.endDate, dimensions: [], rowLimit: 1 } }),
      searchconsole.searchanalytics.query({ siteUrl: site.siteUrl, requestBody: { startDate: dateRange.startDate, endDate: dateRange.endDate, dimensions: ['query'], rowLimit: 5, orderBy: 'clicks', orderDirection: 'descending' } }),
      searchconsole.searchanalytics.query({ siteUrl: site.siteUrl, requestBody: { startDate: dateRange.startDate, endDate: dateRange.endDate, dimensions: ['page'], rowLimit: 5, orderBy: 'clicks', orderDirection: 'descending' } }),
    ]);
    const totals = totalsRes.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    const topQueries = (queriesRes.data.rows || []).map(r => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: Math.round(r.ctr * 1000) / 10, position: Math.round(r.position * 10) / 10 }));
    const topPages = (pagesRes.data.rows || []).map(r => ({ page: r.keys[0].replace(/^https?:\/\/[^/]+/, ''), clicks: r.clicks, impressions: r.impressions }));
    return {
      siteUrl: site.domain,
      totals: { clicks: totals.clicks || 0, impressions: totals.impressions || 0, ctr: Math.round((totals.ctr || 0) * 1000) / 10, position: Math.round((totals.position || 0) * 10) / 10 },
      topQueries, topPages,
    };
  } catch (error) {
    return { siteUrl: site.domain, totals: { clicks: 0, impressions: 0, ctr: 0, position: 0 }, topQueries: [], topPages: [], error: error.message };
  }
}

export async function POST(request) {
  try {
    const { days = 28 } = await request.json();
    const auth = getGSCAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });

    // Lista dinámica desde GSC — sin array hardcodeado
    const sites = await getVerifiedSites(auth);

    const dateRange = getDateRange(days);
    const results = await Promise.all(sites.map(site => fetchSiteData(searchconsole, site, dateRange)));

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
