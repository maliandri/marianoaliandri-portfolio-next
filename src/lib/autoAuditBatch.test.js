// src/lib/autoAuditBatch.test.js
import { describe, it, expect, vi } from 'vitest';

// Evita cargar firebase-admin/authServer reales; runBatch recibe `run` inyectado.
vi.mock('@/app/api/lead-finder/route', () => ({ runLeadFinderAction: vi.fn() }));

import { runBatch, MAX_BUSQUEDAS } from './autoAuditBatch.js';

const TYPE = { ciudad: 'Mendoza', rubro: { label: 'Ferretería', kind: 'type', value: 'hardware_store', prioritario: true } };
const TEXT = { ciudad: 'Salta', rubro: { label: 'Steel framing', kind: 'text', value: 'steel framing', prioritario: false } };
const place = (id, name = id) => ({ id, displayName: { text: name }, location: { latitude: 1, longitude: 2 } });
const audited = (over = {}) => ({
  ok: true, hasWebsite: true, siteUrl: 'https://x.com', seoScore: 40, hasSitemap: false, hasRobots: true,
  metaDesc: null, hasOG: false, email: null, lastUpdated: null, rating: 4.2, ...over,
});
const noWeb = { ok: true, hasWebsite: false, siteUrl: null, internationalPhone: '+54 9 261 555-1234' };
const makeRun = (h) => vi.fn(async (action, params) => Response.json(await h[action](params)));
const noSleep = async () => {};
const geoOk = () => ({ ok: true, lat: -32.9, lon: -68.8 });

describe('runBatch', () => {
  it('rubro type: usa searchNearby con el tipo y arma los resultados con rubro y apto', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: [place('p1', 'Ferretería Uno')], nextPageToken: null }),
      auditPlace: () => audited({ siteUrl: 'https://uno.com', email: 'a@uno.com' }),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(run).toHaveBeenCalledWith('geocode', { city: 'Mendoza', country: 'Argentina' });
    expect(run).toHaveBeenCalledWith('searchNearby', expect.objectContaining({ type: 'hardware_store', radiusM: 15000 }));
    expect(out).toMatchObject({ status: 'ok', examined: 1, found: 1 });
    expect(out.results[0]).toMatchObject({
      id: 'p1', nombre: 'Ferretería Uno', ciudad: 'Mendoza', tipo: 'Ferretería', rubro: 'Ferretería',
      aptoSistemaMedida: true, siteUrl: 'https://uno.com', email: 'a@uno.com', seoScore: 40,
    });
  });

  it('rubro text: usa searchText con "<término>, <ciudad>"', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchText: () => ({ ok: true, places: [place('p1')], nextPageToken: null }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(TEXT, { run, sleep: noSleep });
    expect(run).toHaveBeenCalledWith('searchText', expect.objectContaining({ query: 'steel framing, Salta' }));
    expect(out.results[0]).toMatchObject({ tipo: 'Steel framing', aptoSistemaMedida: false });
  });

  it('descarta los sin web (aunque tengan WhatsApp) y los de seoScore nulo', async () => {
    const audits = { a: noWeb, b: audited({ seoScore: null }), c: audited() };
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: ({ placeId }) => audits[placeId],
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.results.map(r => r.id)).toEqual(['c']);
    expect(out.examined).toBe(3);
  });

  it('zona: busca en cada localidad con la cabecera al final y reparte el cupo', async () => {
    const ZONA = { ciudad: 'Alto Valle', ciudades: ['Neuquén', 'Plottier', 'Centenario'], rubro: TEXT.rubro };
    const run = makeRun({
      geocode: geoOk,
      searchText: ({ query }) => ({
        ok: true,
        places: ['1', '2', '3', '4', '5', '6', '7', '8'].map(n => place(`${query}-${n}`)),
        nextPageToken: null,
      }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(ZONA, { run, sleep: noSleep, maxSites: 30, maxCandidates: 9 });
    const ciudades = run.mock.calls.filter(([a]) => a === 'geocode').map(([, p]) => p.city);
    expect(ciudades).toEqual(['Plottier', 'Centenario', 'Neuquén']);
    const porCiudad = {};
    for (const r of out.results) porCiudad[r.ciudad] = (porCiudad[r.ciudad] || 0) + 1;
    expect(porCiudad).toEqual({ Plottier: 3, Centenario: 3, Neuquén: 3 });
  });

  it('zona: "Ciudad (Provincia)" se busca como "Ciudad, Provincia"', async () => {
    const ZONA = { ciudad: 'Gran Mendoza', ciudades: ['Mendoza', 'Las Heras (Mendoza)'], rubro: TEXT.rubro };
    const run = makeRun({
      geocode: geoOk,
      searchText: () => ({ ok: true, places: [], nextPageToken: null }),
      auditPlace: () => audited(),
    });
    await runBatch(ZONA, { run, sleep: noSleep });
    expect(run).toHaveBeenCalledWith('geocode', { city: 'Las Heras, Mendoza', country: 'Argentina' });
  });

  it('rubro agrupado: busca cada término y cada tipo, sin repetir negocios', async () => {
    const GRUPO = { ciudad: 'Neuquén', rubro: { label: 'Corralones', prioritario: true, terminos: ['corralón', 'materiales'], tipos: ['hardware_store'] } };
    const run = makeRun({
      geocode: geoOk,
      searchText: ({ query }) => ({ ok: true, places: [place('comun'), place(query)], nextPageToken: null }),
      searchNearby: () => ({ ok: true, places: [place('comun'), place('ferre')], nextPageToken: null }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(GRUPO, { run, sleep: noSleep, maxSites: 30, maxCandidates: 30 });
    expect(run).toHaveBeenCalledWith('searchNearby', expect.objectContaining({ type: 'hardware_store' }));
    expect(run).toHaveBeenCalledWith('searchText', expect.objectContaining({ query: 'corralón, Neuquén' }));
    expect(run).toHaveBeenCalledWith('searchText', expect.objectContaining({ query: 'materiales, Neuquén' }));
    expect(out.results.map(r => r.id).sort()).toEqual(['comun', 'corralón, Neuquén', 'ferre', 'materiales, Neuquén']);
    expect(out.results.every(r => r.rubro === 'Corralones')).toBe(true);
  });

  it('no pasa de MAX_BUSQUEDAS búsquedas por corrida', async () => {
    const ZONA = { ciudad: 'Z', ciudades: Array.from({ length: 12 }, (_, i) => `C${i}`),
      rubro: { label: 'G', prioritario: true, terminos: ['a', 'b', 'c', 'd'], tipos: [] } };
    const run = makeRun({ geocode: geoOk, searchText: () => ({ ok: true, places: [], nextPageToken: null }), auditPlace: () => audited() });
    await runBatch(ZONA, { run, sleep: noSleep });
    expect(run.mock.calls.filter(([a]) => a === 'searchText')).toHaveLength(MAX_BUSQUEDAS);
  });

  it('respeta maxSites', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: ['a', 'b', 'c'].map(id => place(id)), nextPageToken: null }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, maxSites: 2 });
    expect(out.results).toHaveLength(2);
  });

  it('respeta maxCandidates (cuida el cupo de getDetails)', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: ['a', 'b', 'c', 'd'].map(id => place(id)), nextPageToken: null }),
      auditPlace: () => noWeb,
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, maxCandidates: 3 });
    expect(out.examined).toBe(3);
    expect(run.mock.calls.filter(c => c[0] === 'auditPlace')).toHaveLength(3);
    expect(out.agotado).toBe(false);
  });

  it('QUOTA_EXCEEDED corta y conserva lo auditado hasta ahí', async () => {
    const audits = { a: audited(), b: { ok: false, error: 'cuota', code: 'QUOTA_EXCEEDED' } };
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: [place('a'), place('b'), place('c')], nextPageToken: null }),
      auditPlace: ({ placeId }) => audits[placeId] || audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('cuota_agotada');
    expect(out.results.map(r => r.id)).toEqual(['a']);
    expect(out.examined).toBe(2);
  });

  it('un error de auditPlace que no es de cuota se saltea y sigue', async () => {
    const audits = { a: { ok: false, error: 'timeout' }, b: audited() };
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: [place('a'), place('b')], nextPageToken: null }),
      auditPlace: ({ placeId }) => audits[placeId],
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('ok');
    expect(out.results.map(r => r.id)).toEqual(['b']);
  });

  it('corta al agotar el presupuesto de tiempo', async () => {
    let t = 0;
    const now = () => t;
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: ['a', 'b', 'c'].map(id => place(id)), nextPageToken: null }),
      auditPlace: () => { t += 20000; return audited(); },
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep, now, budgetMs: 30000 });
    expect(out.results.map(r => r.id)).toEqual(['a', 'b']);
    expect(out.agotado).toBe(false);
    expect(out.cortadoPorTiempo).toBe(true);
  });

  it('agotado es true cuando se examinaron todos los negocios que había', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchNearby: () => ({ ok: true, places: ['a', 'b'].map(id => place(id)), nextPageToken: null }),
      auditPlace: () => noWeb,
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.examined).toBe(2);
    expect(out.agotado).toBe(true);
  });

  it('si la ciudad no se geocodifica devuelve status error sin buscar', async () => {
    const run = makeRun({ geocode: () => ({ ok: false, error: 'Ciudad no encontrada: Mendoza' }) });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('error');
    expect(out.error).toContain('Mendoza');
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('si la búsqueda falla en la primera página devuelve status error', async () => {
    const run = makeRun({ geocode: geoOk, searchNearby: () => ({ ok: false, error: 'Unsupported types: x.' }) });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.status).toBe('error');
    expect(out.error).toContain('Unsupported types');
  });

  it('pagina con nextPageToken y deduplica por id', async () => {
    const run = makeRun({
      geocode: geoOk,
      searchNearby: ({ pageToken }) => (pageToken
        ? { ok: true, places: [place('b'), place('c')], nextPageToken: null }
        : { ok: true, places: [place('a'), place('b')], nextPageToken: 'T1' }),
      auditPlace: () => audited(),
    });
    const out = await runBatch(TYPE, { run, sleep: noSleep });
    expect(out.results.map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(out.found).toBe(3);
  });
});
