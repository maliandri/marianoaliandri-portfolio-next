import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { createFakeDb } from '@/test/fakeDb';
import { createLeadJob, runLeadJob, toEngineParams } from './leadJobs';

const USER = { uid: 'u1', email: 'm@x.com' };
const PARAMS = { localidades: ['Neuquén, Neuquén'], rubros: [], terminos: ['Panadería'], cantidad: 2, radio_km: 10 };

// Google falso: 3 negocios por búsqueda, todos con web.
function fakeCall({ auditFromCache = false } = {}) {
  const calls = [];
  const call = vi.fn(async (action, p) => {
    calls.push(action);
    if (action === 'geocode') return { ok: true, lat: -38.9, lon: -68.1 };
    if (action === 'searchText') return { ok: true, places: [1, 2, 3].map(i => ({ id: `p${i}`, displayName: { text: `Pana ${i}` } })) };
    if (action === 'auditPlace') return { ok: true, esLead: true, canal: 'web', whatsapp: null, siteUrl: `https://${p.placeId}.com`, seoScore: 40, fromCache: auditFromCache };
    if (action === 'rubroDemand') return { ok: true, porTermino: { Panadería: { interes: 80, ejemplos: ['panaderia neuquen'] } } };
    throw new Error(`acción inesperada ${action}`);
  });
  return { call, calls };
}

beforeEach(() => { delete process.env.MCP_PLACES_DAILY_CAP; });

describe('toEngineParams', () => {
  it('agrega Argentina si la localidad no trae país', () => {
    const p = toEngineParams(PARAMS);
    expect(p.zonas).toEqual([{ ciudad: 'Neuquén, Neuquén', pais: 'Argentina' }]);
    expect(p.terminos).toEqual(['Panadería']);
    expect(p.radioKm).toBe(10);
  });
});

describe('runLeadJob', () => {
  it('termina done, guarda en el historial con via mcp y cruza la demanda', async () => {
    const { db, docs } = createFakeDb();
    const jobId = await createLeadJob(db, USER.uid, PARAMS);
    const { call } = fakeCall();
    await runLeadJob(db, USER, jobId, PARAMS, { call, sleep: async () => {} });

    const job = docs[`mcp_lead_jobs/${jobId}`];
    expect(job.status).toBe('done');
    expect(job.leads).toHaveLength(2);
    expect(job.leads[0].demanda).toMatchObject({ interes: 80 });
    expect(job.searchId).toBeTruthy();
    const saved = docs[`leadfinder_searches/u1/items/${job.searchId}`];
    expect(saved).toMatchObject({ origen: 'admin', via: 'mcp' });
    expect(saved.results).toHaveLength(2);
    expect(docs[`leadfinder_usage/${new Date().toISOString().slice(0, 10)}`].mcpPlaces).toBe(3); // 1 búsqueda + 2 detalles
  });

  it('sin cupo de Places termina done con aviso y deja de llamar a Google', async () => {
    process.env.MCP_PLACES_DAILY_CAP = '2';
    const { db, docs } = createFakeDb();
    const jobId = await createLeadJob(db, USER.uid, { ...PARAMS, cantidad: 3 });
    const { call, calls } = fakeCall();
    await runLeadJob(db, USER, jobId, { ...PARAMS, cantidad: 3 }, { call, sleep: async () => {} });

    const job = docs[`mcp_lead_jobs/${jobId}`];
    expect(job.status).toBe('done');
    expect(job.avisos.some(a => a.includes('cupo'))).toBe(true);
    expect(calls.filter(a => a === 'searchText' || a === 'auditPlace')).toHaveLength(2);
  });

  it('los detalles que salen de caché no cuentan', async () => {
    const { db, docs } = createFakeDb();
    const jobId = await createLeadJob(db, USER.uid, PARAMS);
    const { call } = fakeCall({ auditFromCache: true });
    await runLeadJob(db, USER, jobId, PARAMS, { call, sleep: async () => {} });
    expect(docs[`leadfinder_usage/${new Date().toISOString().slice(0, 10)}`].mcpPlaces).toBe(1);
  });

  it('un error fatal deja el job en error con el mensaje', async () => {
    const { db, docs } = createFakeDb();
    const jobId = await createLeadJob(db, USER.uid, PARAMS);
    const call = vi.fn(async (action) => {
      if (action === 'geocode') return { ok: true, lat: 1, lon: 1 };
      if (action === 'rubroDemand') return { ok: true };
      throw Object.assign(new Error('No tenés un plan activo'), { code: 'NO_PLAN' });
    });
    await runLeadJob(db, USER, jobId, PARAMS, { call, sleep: async () => {} });
    expect(docs[`mcp_lead_jobs/${jobId}`]).toMatchObject({ status: 'error', error: 'No tenés un plan activo' });
  });
});
