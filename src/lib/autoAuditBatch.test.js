import { describe, it, expect, vi } from 'vitest';

// Evita cargar firebase-admin/authServer reales; runBatch recibe `run` inyectado.
vi.mock('@/app/api/lead-finder/route', () => ({ runLeadFinderAction: vi.fn() }));

import { runBatch } from './autoAuditBatch.js';

const json = (o) => Response.json(o);
const TYPE = { ciudad: 'Mendoza', rubro: { label: 'Ferretería', kind: 'type', value: 'hardware_store', prioritario: true } };
const TEXT = { ciudad: 'Salta', rubro: { label: 'Steel framing', kind: 'text', value: 'steel framing', prioritario: true } };
const place = (id, name = id) => ({ id, displayName: { text: name }, location: { latitude: 1, longitude: 2 } });
const audited = (over = {}) => ({
  ok: true, hasWebsite: true, siteUrl: 'https://x.com', seoScore: 40, hasSitemap: false, hasRobots: true,
  metaDesc: null, hasOG: false, email: null, lastUpdated: null, rating: 4.2, ...over,
});

function makeRun(handlers) {
  return vi.fn(async (action, params) => json(await handlers[action](params)));
}
const noSleep = async () => {};

describe('runBatch', () => {
  it('rubro type: usa searchNearby con el tipo y arma los resultados con rubro y apto', async () => {
    const run = makeRun({
      geocode: () => ({ ok: true, lat: -32.9, lon: -68.8 }),
      searchNearby: () => ({ ok: true, places: [place('p1', 'Ferretería Uno')], nextPageToken: null }),
      auditPlace: () => audited({ siteUrl: 'https://uno.com', email: 'a@uno.com' }),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(run).toHaveBeenCalledWith('searchNearby', expect.objectContaining({ type: 'hardware_store', radiusM: 15000 }));
    expect(out.status).toBe('ok');
    expect(out.results).toHaveLength(1);
    expect(out.results[0]).toMatchObject({
      id: 'p1', nombre: 'Ferretería Uno', ciudad: 'Mendoza', tipo: 'Ferretería', rubro: 'Ferretería',
      aptoSistemaMedida: true, siteUrl: 'https://uno.com', email: 'a@uno.com', seoScore: 40,
    });
  });

  it('rubro text: usa searchText con "<término>, <ciudad>"', async () => {
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchText: () => ({ ok: true, places: [place('p1')], nextPageToken: null }),
      auditPlace: () => audited(),
    });
    await runBatch(TEXT, { run, sleep: noSleep });
    expect(run).toHaveBeenCalledWith('searchText', expect.objectContaining({ query: 'steel framing, Salta' }));
  });

  it('descarta lugares sin sitio web o con seoScore nulo', async () => {
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: ({ placeId }) => ({
        a: audited({ hasWebsite: false, siteUrl: null, seoScore: null }),
        b: audited({ seoScore: null }),
        c: audited(),
      }[placeId]),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.results.map(r => r.id)).toEqual(['c']);
    expect(out.examined).toBe(3);
  });

  it('respeta maxSites', async () => {
    const places = ['a', 'b', 'c', 'd'].map(id => place(id));
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places, nextPageToken: null }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, maxSites: 2 });
    expect(out.results).toHaveLength(2);
  });

  it('respeta maxCandidates (cuida el tope diario de getDetails)', async () => {
    const places = ['a', 'b', 'c', 'd'].map(id => place(id));
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places, nextPageToken: null }),
      auditPlace: () => audited({ hasWebsite: false, seoScore: null }),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, maxCandidates: 3 });
    expect(out.examined).toBe(3);
  });

  it('QUOTA_EXCEEDED corta y conserva lo auditado hasta ahí', async () => {
    const calls = { n: 0 };
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: () => (++calls.n === 2 ? { ok: false, code: 'QUOTA_EXCEEDED', error: 'límite' } : audited()),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('cuota_agotada');
    expect(out.results.map(r => r.id)).toEqual(['a']);
  });

  it('un error de auditPlace que no es de cuota se saltea y sigue', async () => {
    const calls = { n: 0 };
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places: [place('a'), place('b')], nextPageToken: null }),
      auditPlace: () => (++calls.n === 1 ? { ok: false, error: 'boom' } : audited()),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('ok');
    expect(out.results.map(r => r.id)).toEqual(['b']);
  });

  it('corta al agotar el presupuesto de tiempo', async () => {
    let t = 0;
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: () => { t += 20000; return audited(); },
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, budgetMs: 30000, now: () => t });
    expect(out.results).toHaveLength(2);
  });

  it('si la ciudad no se geocodifica devuelve status error sin buscar', async () => {
    const run = makeRun({ geocode: () => ({ ok: false, error: 'Ciudad no encontrada: Mendoza' }) });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out).toMatchObject({ status: 'error', results: [], examined: 0 });
    expect(out.error).toContain('Ciudad no encontrada');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('si la búsqueda falla en la primera página devuelve status error', async () => {
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => ({ ok: false, error: 'Error de Google Places' }),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('error');
  });

  it('pagina una vez más con nextPageToken y deduplica por id', async () => {
    const pages = [
      { ok: true, places: [place('a'), place('b')], nextPageToken: 'T2' },
      { ok: true, places: [place('b'), place('c')], nextPageToken: 'T3' },
    ];
    let i = 0;
    const run = makeRun({
      geocode: () => ({ ok: true, lat: 1, lon: 2 }),
      searchNearby: () => pages[i++],
      auditPlace: () => audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, pages: 2 });
    expect(out.results.map(r => r.id)).toEqual(['a', 'b', 'c']);
  });
});
