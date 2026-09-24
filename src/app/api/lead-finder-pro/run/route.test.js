import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/authServer', () => ({
  getUserFromRequest: vi.fn(),
}));
vi.mock('@/lib/firebase-admin', () => ({
  getDb: vi.fn(),
}));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: (n) => ({ __op: 'increment', n }),
    serverTimestamp: () => ({ __op: 'serverTimestamp' }),
  },
}));
vi.mock('../../lead-finder/route', () => ({
  runLeadFinderAction: vi.fn(),
}));
vi.mock('@/lib/productCounter', async (importOriginal) => ({
  ...(await importOriginal()),
  countProducts: vi.fn(),
}));

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { runLeadFinderAction } from '../../lead-finder/route';
import { countProducts } from '@/lib/productCounter';
import { POST } from './route.js';

function resolveFieldValues(data, prev) {
  const out = { ...prev };
  for (const [k, v] of Object.entries(data)) {
    if (v && v.__op === 'increment') out[k] = (prev[k] || 0) + v.n;
    else if (v && v.__op === 'serverTimestamp') out[k] = 'SERVER_TIMESTAMP';
    else out[k] = v;
  }
  return out;
}

// Minimal in-memory Firestore fake — enough surface for the credit-gate
// transaction in this route (collection/doc chaining, runTransaction, merge writes).
function createFakeDb(initialDocs = {}) {
  const docs = { ...initialDocs };
  const writes = [];

  function makeDocRef(path) {
    return {
      async get() {
        const data = docs[path];
        return { exists: data !== undefined, data: () => data };
      },
      async set(data, opts) {
        const prev = docs[path] || {};
        docs[path] = opts?.merge ? resolveFieldValues(data, prev) : resolveFieldValues(data, {});
        writes.push({ path, data, opts });
      },
      collection(subName) {
        return makeCollectionRef(`${path}/${subName}`);
      },
    };
  }
  function makeCollectionRef(path) {
    return { doc: (id) => makeDocRef(`${path}/${id}`) };
  }

  return {
    db: {
      collection: (name) => makeCollectionRef(name),
      async runTransaction(fn) {
        const tx = {
          get: (ref) => ref.get(),
          set: (ref, data, opts) => ref.set(data, opts),
        };
        return fn(tx);
      },
    },
    docs,
    writes,
  };
}

function makeRequest(body) {
  return { json: async () => body };
}

const USER = { uid: 'client-1', email: 'client@example.com' };

describe('POST /api/lead-finder-pro/run — gate de créditos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza sin autenticación (401)', async () => {
    getUserFromRequest.mockResolvedValue(null);
    const res = await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }));
    expect(res.status).toBe(401);
  });

  it('deja pasar una acción gratis (searchNearby) sin tocar Firestore', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    runLeadFinderAction.mockResolvedValue(Response.json({ ok: true, results: [] }));

    const res = await POST(makeRequest({ action: 'searchNearby', lat: 1, lng: 2 }));

    expect(res.status).toBe(200);
    expect(getDb).not.toHaveBeenCalled();
    expect(runLeadFinderAction).toHaveBeenCalledWith('searchNearby', { lat: 1, lng: 2 }, undefined);
  });

  it('rechaza auditPlace sin placeId (400)', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    getDb.mockReturnValue(createFakeDb().db);
    const res = await POST(makeRequest({ action: 'auditPlace' }));
    expect(res.status).toBe(400);
  });

  it('devuelve 402 NO_PLAN cuando no hay entitlement activo', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db } = createFakeDb(); // sin doc en leadfinder_entitlements
    getDb.mockReturnValue(db);

    const res = await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }));
    const data = await res.json();

    expect(res.status).toBe(402);
    expect(data.code).toBe('NO_PLAN');
    expect(runLeadFinderAction).not.toHaveBeenCalled();
  });

  it('con saldo de créditos: audita, descuenta 1 crédito y guarda el historial', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db, docs } = createFakeDb({
      'leadfinder_entitlements/client-1': { credits: 3 },
    });
    getDb.mockReturnValue(db);
    runLeadFinderAction.mockResolvedValue(Response.json({ ok: true, seoScore: 80 }));

    const res = await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(docs['leadfinder_entitlements/client-1'].credits).toBe(2);
    expect(docs['leadfinder_client_audits/client-1/audits/p1']).toBeDefined();
  });

  it('si el negocio ya fue auditado antes por este cliente, devuelve el caché sin gastar crédito', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db, docs } = createFakeDb({
      'leadfinder_entitlements/client-1': { credits: 5 },
      'leadfinder_client_audits/client-1/audits/p1': { seoScore: 42, auditedAt: 'x' },
    });
    getDb.mockReturnValue(db);

    const res = await POST(makeRequest({ action: 'auditPlace', placeId: 'p1' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.fromCache).toBe(true);
    expect(data.fromMyHistory).toBe(true);
    expect(runLeadFinderAction).not.toHaveBeenCalled();
    expect(docs['leadfinder_entitlements/client-1'].credits).toBe(5); // sin descontar
  });
});

describe('POST /api/lead-finder-pro/run — countProducts', () => {
  const AUDIT = 'leadfinder_client_audits/client-1/audits/p1';
  const COUNT = { count: 12, confidence: 'catalogo', platform: 'shopify', partial: false };

  beforeEach(() => {
    vi.clearAllMocks();
    getUserFromRequest.mockResolvedValue(USER);
  });

  it('rechaza sin autenticación (401)', async () => {
    getUserFromRequest.mockResolvedValue(null);
    const res = await POST(makeRequest({ action: 'countProducts', placeId: 'p1', keyword: 'celular' }));
    expect(res.status).toBe(401);
    expect(countProducts).not.toHaveBeenCalled();
  });

  it.each([
    [{ keyword: 'celular' }],
    [{ placeId: 'p1' }],
    [{ placeId: 'p1', keyword: 'a' }],
    [{ placeId: 'p1', keyword: 'x'.repeat(61) }],
    [{ placeId: 'a/b', keyword: 'celular' }],
  ])('400 con parámetros inválidos %j', async (params) => {
    getDb.mockReturnValue(createFakeDb().db);
    const res = await POST(makeRequest({ action: 'countProducts', ...params }));
    expect(res.status).toBe(400);
    expect(countProducts).not.toHaveBeenCalled();
  });

  it('no aplica si el cliente nunca auditó ese negocio (no acepta cualquier placeId)', async () => {
    getDb.mockReturnValue(createFakeDb().db);
    const res = await POST(makeRequest({ action: 'countProducts', placeId: 'p1', keyword: 'celular' }));
    const data = await res.json();
    expect(data).toEqual({ ok: true, applicable: false });
    expect(countProducts).not.toHaveBeenCalled();
  });

  it('no aplica si el negocio auditado no tiene sitio', async () => {
    getDb.mockReturnValue(createFakeDb({ [AUDIT]: { hasWebsite: false, siteUrl: null } }).db);
    const res = await POST(makeRequest({ action: 'countProducts', placeId: 'p1', keyword: 'celular' }));
    expect((await res.json()).applicable).toBe(false);
    expect(countProducts).not.toHaveBeenCalled();
  });

  it('usa el siteUrl de la auditoría propia, devuelve el conteo y NO toca créditos', async () => {
    const { db, docs } = createFakeDb({
      [AUDIT]: { siteUrl: 'https://tienda.test' },
      'leadfinder_entitlements/client-1': { credits: 5 },
    });
    getDb.mockReturnValue(db);
    countProducts.mockResolvedValue(COUNT);

    const res = await POST(makeRequest({ action: 'countProducts', placeId: 'p1', keyword: 'Celulares', siteUrl: 'http://evil.internal' }));
    const data = await res.json();

    expect(data).toMatchObject({ ok: true, applicable: true, ...COUNT, fromCache: false });
    expect(countProducts).toHaveBeenCalledWith('https://tienda.test', 'Celulares');
    expect(docs['leadfinder_entitlements/client-1'].credits).toBe(5);
    expect(runLeadFinderAction).not.toHaveBeenCalled();
  });

  it('la segunda llamada con la misma palabra sale del caché', async () => {
    getDb.mockReturnValue(createFakeDb({ [AUDIT]: { siteUrl: 'https://tienda.test' } }).db);
    countProducts.mockResolvedValue(COUNT);
    const body = { action: 'countProducts', placeId: 'p1', keyword: 'Celulares' };

    await POST(makeRequest(body));
    const res2 = await POST(makeRequest({ ...body, keyword: '  celulares ' })); // misma palabra normalizada
    const data2 = await res2.json();

    expect(countProducts).toHaveBeenCalledTimes(1);
    expect(data2).toMatchObject({ applicable: true, count: 12, fromCache: true });
  });

  it('otra palabra clave no reutiliza el caché', async () => {
    getDb.mockReturnValue(createFakeDb({ [AUDIT]: { siteUrl: 'https://tienda.test' } }).db);
    countProducts.mockResolvedValue(COUNT);

    await POST(makeRequest({ action: 'countProducts', placeId: 'p1', keyword: 'celular' }));
    await POST(makeRequest({ action: 'countProducts', placeId: 'p1', keyword: 'notebook' }));

    expect(countProducts).toHaveBeenCalledTimes(2);
  });

  it('un caché vencido (más de 7 días) se recalcula', async () => {
    const old = Date.now() - 8 * 24 * 60 * 60 * 1000;
    getDb.mockReturnValue(createFakeDb({
      [AUDIT]: { siteUrl: 'https://tienda.test' },
      'places_product_count/p1__celular': { ...COUNT, checkedAt: old },
    }).db);
    countProducts.mockResolvedValue({ ...COUNT, count: 30 });

    const res = await POST(makeRequest({ action: 'countProducts', placeId: 'p1', keyword: 'celular' }));
    expect((await res.json()).count).toBe(30);
    expect(countProducts).toHaveBeenCalledTimes(1);
  });

  it('un resultado parcial no se cachea', async () => {
    getDb.mockReturnValue(createFakeDb({ [AUDIT]: { siteUrl: 'https://tienda.test' } }).db);
    countProducts.mockResolvedValue({ ...COUNT, partial: true });
    const body = { action: 'countProducts', placeId: 'p1', keyword: 'celular' };

    await POST(makeRequest(body));
    await POST(makeRequest(body));

    expect(countProducts).toHaveBeenCalledTimes(2);
  });

  it('un conteo fallido (count null) no se cachea y se devuelve igual', async () => {
    getDb.mockReturnValue(createFakeDb({ [AUDIT]: { siteUrl: 'https://tienda.test' } }).db);
    countProducts.mockResolvedValue({ count: null, confidence: null, platform: null, partial: false });
    const body = { action: 'countProducts', placeId: 'p1', keyword: 'celular' };

    const res = await POST(makeRequest(body));
    expect(await res.json()).toMatchObject({ ok: true, applicable: true, count: null });
    await POST(makeRequest(body));
    expect(countProducts).toHaveBeenCalledTimes(2);
  });
});
