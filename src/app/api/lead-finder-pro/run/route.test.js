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

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { runLeadFinderAction } from '../../lead-finder/route';
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
