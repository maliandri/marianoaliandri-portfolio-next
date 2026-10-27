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

describe('embudos', async () => {
  const { stepFilter, assembleFunnels } = await import('./siteStats');

  it('un paso de página filtra page_view y el prefijo; uno de evento, su nombre', () => {
    const page = JSON.stringify(stepFilter({ page: ['/analitica', '/keywords'] }));
    expect(page).toContain('"value":"page_view"');
    expect(page).toContain('"value":"/keywords"');
    const ev = JSON.stringify(stepFilter({ event: 'generate_lead' }));
    expect(ev).toContain('"value":"generate_lead"');
    expect(ev).not.toContain('pagePath');
  });

  it('calcula % del paso anterior y del inicio, sin dividir por cero', () => {
    const funnels = [{ id: 'a', titulo: 'A', pasos: [{ label: '1' }, { label: '2' }, { label: '3' }] }, { id: 'b', titulo: 'B', pasos: [{ label: '1' }, { label: '2' }] }];
    const [a, b] = assembleFunnels(funnels, { f0_0: 200, f0_1: 50, f0_2: 5, f1_0: 0, f1_1: 0 });
    expect(a.pasos.map(p => p.pctPrevio)).toEqual([null, 25, 10]);
    expect(a.pasos[2].pctInicio).toBe(3);
    expect(b.pasos[1]).toMatchObject({ personas: 0, pctPrevio: null, pctInicio: null });
  });
});
