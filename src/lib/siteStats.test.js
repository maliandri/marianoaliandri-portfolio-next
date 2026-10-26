import { describe, it, expect, vi } from 'vitest';

const query = vi.fn(async () => ({ data: { rows: [] } }));
const batchRunReports = vi.fn(async () => ({ data: { reports: [] } }));
vi.mock('googleapis', () => ({
  google: {
    searchconsole: () => ({ searchanalytics: { query } }),
    analyticsdata: () => ({ properties: { batchRunReports } }),
    auth: { JWT: vi.fn(function () {}) },
  },
}));
vi.mock('@/lib/gscClient', () => ({ getGSCAuth: () => ({}), getVerifiedSites: async () => [] }));
import { fetchGSC, fetchGA4 } from './siteStats';

describe('siteStats', () => {
  it('GSC usa el período pedido', async () => {
    await fetchGSC({ days: 7 });
    const { startDate, endDate } = query.mock.calls[0][0].requestBody;
    expect((new Date(endDate) - new Date(startDate)) / 86400000).toBe(7);
  });

  it('GA4 usa el período pedido', async () => {
    process.env.GA4_PROPERTY_ID = '123';
    await fetchGA4({ days: 90 });
    expect(batchRunReports.mock.calls[0][0].requestBody.requests[0].dateRanges[0].startDate).toBe('90daysAgo');
  });
});
