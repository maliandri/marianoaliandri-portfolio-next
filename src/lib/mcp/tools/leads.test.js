import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/lib/leadFinderPro', () => ({ makeLeadFinderCall: vi.fn(() => async () => ({ ok: true })) }));
import { after } from 'next/server';
import { createFakeDb } from '@/test/fakeDb';
import { searchLeadsTool, getLeadSearchTool } from './leads';
import { ToolError } from '../defineTool';

const user = { uid: 'u1', email: 'm@x.com' };
const today = new Date().toISOString().slice(0, 10);

describe('search_leads', () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.MCP_PLACES_DAILY_CAP; });

  it('crea el job y lo corre en segundo plano', async () => {
    const { db, docs } = createFakeDb();
    const r = await searchLeadsTool.handler({ localidades: ['Neuquén, Neuquén'], terminos: ['durlock'], cantidad: 2 }, { db, user });
    expect(r.data.status).toBe('running');
    expect(docs[`mcp_lead_jobs/${r.data.jobId}`].uid).toBe('u1');
    expect(after).toHaveBeenCalledTimes(1);
  });

  it('sin cupo diario no lanza nada', async () => {
    const { db } = createFakeDb({ [`leadfinder_usage/${today}`]: { mcpPlaces: 150 } });
    await expect(searchLeadsTool.handler({ localidades: ['Neuquén'], terminos: ['x1'], cantidad: 2 }, { db, user }))
      .rejects.toThrow(ToolError);
    expect(after).not.toHaveBeenCalled();
  });

  it('rubros desconocidos o sin rubro ni término → ToolError', async () => {
    const { db } = createFakeDb();
    await expect(searchLeadsTool.handler({ localidades: ['Neuquén'], rubros: ['no-existe'], cantidad: 2 }, { db, user })).rejects.toThrow(/desconocidos/);
    await expect(searchLeadsTool.handler({ localidades: ['Neuquén'], cantidad: 2 }, { db, user })).rejects.toThrow(/al menos/);
  });
});

describe('get_lead_search', () => {
  it('pagina los leads de un job ordenados por oportunidad, y no deja ver jobs ajenos', async () => {
    const leads = [
      { id: 'a', nombre: 'A', siteUrl: 'https://a.com', seoScore: 90, demanda: { interes: 50 } },
      { id: 'b', nombre: 'B', siteUrl: 'https://b.com', seoScore: 10, demanda: { interes: 50 } },
      { id: 'c', nombre: 'C', siteUrl: 'https://c.com', seoScore: 50, demanda: { interes: 50 } },
    ];
    const { db } = createFakeDb({ 'mcp_lead_jobs/j1': { uid: 'u1', status: 'done', totals: { leads: 3 }, avisos: [], leads } });
    const p1 = await getLeadSearchTool.handler({ job_id: 'j1', limit: 2 }, { db, user });
    expect(p1.data.items.map(i => i.placeId)).toEqual(['b', 'c']);
    const p2 = await getLeadSearchTool.handler({ job_id: 'j1', limit: 2, cursor: p1.data.nextCursor }, { db, user });
    expect(p2.data.items.map(i => i.placeId)).toEqual(['a']);
    await expect(getLeadSearchTool.handler({ job_id: 'j1' }, { db, user: { uid: 'otro' } })).rejects.toThrow(ToolError);
  });
});
