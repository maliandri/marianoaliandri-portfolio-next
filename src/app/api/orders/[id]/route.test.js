import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/authServer', () => ({
  getUserFromRequest: vi.fn(),
}));
vi.mock('@/lib/firebase-admin', () => ({
  getDb: vi.fn(),
}));

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { GET } from './route.js';

function createFakeDb(initialDocs = {}) {
  const docs = { ...initialDocs };
  return {
    db: {
      collection: (name) => ({
        doc: (id) => ({
          async get() {
            const data = docs[`${name}/${id}`];
            return { exists: data !== undefined, data: () => data, id };
          },
        }),
      }),
    },
  };
}

function makeRequest() {
  return {};
}

const USER = { uid: 'client-1', email: 'client@example.com' };

describe('GET /api/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza sin autenticación (401)', async () => {
    getUserFromRequest.mockResolvedValue(null);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'o1' }) });
    expect(res.status).toBe(401);
  });

  it('404 si el pedido no existe', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    getDb.mockReturnValue(createFakeDb().db);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'no-existe' }) });
    expect(res.status).toBe(404);
  });

  it('403 si el pedido no es del usuario autenticado', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db } = createFakeDb({ 'orders/o1': { userId: 'otro-uid', customerEmail: 'otro@example.com' } });
    getDb.mockReturnValue(db);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'o1' }) });
    expect(res.status).toBe(403);
  });

  it('200 si el pedido es del usuario por userId', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db } = createFakeDb({
      'orders/o1': { userId: 'client-1', type: 'store', stage: 'en_desarrollo', stageHistory: [], items: [], totalARS: 1000 },
    });
    getDb.mockReturnValue(db);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'o1' }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.stage).toBe('en_desarrollo');
  });

  it('200 si el pedido es del usuario por customerEmail (case-insensitive)', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db } = createFakeDb({
      'orders/o1': { customerEmail: 'Client@Example.com', type: 'cv_analysis', items: [], totalARS: 15000 },
    });
    getDb.mockReturnValue(db);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'o1' }) });
    expect(res.status).toBe(200);
  });

  it('un pedido sin stage devuelve el default "pago_confirmado"', async () => {
    getUserFromRequest.mockResolvedValue(USER);
    const { db } = createFakeDb({
      'orders/o1': { userId: 'client-1', type: 'store', items: [], totalARS: 1000 },
    });
    getDb.mockReturnValue(db);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'o1' }) });
    const data = await res.json();
    expect(data.stage).toBe('pago_confirmado');
  });
});
