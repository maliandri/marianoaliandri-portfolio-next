import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: {
        arrayUnion: (entry) => ({ __op: 'arrayUnion', entry }),
      },
      Timestamp: { now: () => ({ __op: 'timestampNow' }) },
    },
  },
  getDb: vi.fn(),
}));

const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'email-1' } });
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () { return { emails: { send: mockResendSend } }; }),
}));

import { getDb } from '@/lib/firebase-admin';
import { POST } from './route.js';

// Fake Firestore mínimo: soporta doc().get()/.set()/.update(), incluyendo arrayUnion (lo
// único que usa esta ruta además de valores planos).
function createFakeDb(initialDocs = {}) {
  const docs = { ...initialDocs };

  function applyUpdate(path, data) {
    const prev = docs[path] || {};
    const next = { ...prev };
    for (const [k, v] of Object.entries(data)) {
      if (v && v.__op === 'arrayUnion') next[k] = [...(prev[k] || []), v.entry];
      else next[k] = v;
    }
    docs[path] = next;
  }

  function makeDocRef(path) {
    return {
      async get() {
        const data = docs[path];
        return { exists: data !== undefined, data: () => data, id: path.split('/').pop() };
      },
      async update(data) { applyUpdate(path, data); },
      async set(data) { docs[path] = data; },
    };
  }

  return {
    db: { collection: (name) => ({ doc: (id) => makeDocRef(`${name}/${id}`) }) },
    docs,
  };
}

function makeRequest(body) {
  return { json: async () => body };
}

const ORIGINAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

describe('POST /api/orders/update-stage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResendSend.mockResolvedValue({ data: { id: 'email-1' } });
    process.env.ADMIN_PASSWORD = 'secreto';
  });

  afterAll(() => {
    process.env.ADMIN_PASSWORD = ORIGINAL_ADMIN_PASSWORD;
  });

  it('rechaza sin la contraseña de admin correcta (401)', async () => {
    const res = await POST(makeRequest({ adminPassword: 'mala', orderId: 'o1', stage: 'en_desarrollo' }));
    expect(res.status).toBe(401);
  });

  it('rechaza un stage inválido (400)', async () => {
    const { db } = createFakeDb();
    getDb.mockReturnValue(db);
    const res = await POST(makeRequest({ adminPassword: 'secreto', orderId: 'o1', stage: 'volando' }));
    expect(res.status).toBe(400);
  });

  it('404 si el pedido no existe', async () => {
    const { db } = createFakeDb();
    getDb.mockReturnValue(db);
    const res = await POST(makeRequest({ adminPassword: 'secreto', orderId: 'no-existe', stage: 'en_desarrollo' }));
    expect(res.status).toBe(404);
  });

  it('rechaza retroceder o repetir la etapa actual (400)', async () => {
    const { db } = createFakeDb({ 'orders/o1': { stage: 'en_revision', customerEmail: 'c@example.com' } });
    getDb.mockReturnValue(db);

    const repeat = await POST(makeRequest({ adminPassword: 'secreto', orderId: 'o1', stage: 'en_revision' }));
    expect(repeat.status).toBe(400);

    const back = await POST(makeRequest({ adminPassword: 'secreto', orderId: 'o1', stage: 'en_desarrollo' }));
    expect(back.status).toBe(400);
  });

  it('permite saltar etapas hacia adelante y guarda la nota en el historial', async () => {
    const { db, docs } = createFakeDb({ 'orders/o1': { stage: 'pago_confirmado', customerEmail: 'c@example.com' } });
    getDb.mockReturnValue(db);

    const res = await POST(makeRequest({ adminPassword: 'secreto', orderId: 'o1', stage: 'entregado', note: 'Listo, ya está online' }));

    expect(res.status).toBe(200);
    expect(docs['orders/o1'].stage).toBe('entregado');
    expect(docs['orders/o1'].stageHistory).toHaveLength(1);
    expect(docs['orders/o1'].stageHistory[0].note).toBe('Listo, ya está online');
  });

  it('manda el email al cliente cuando hay customerEmail', async () => {
    const { db } = createFakeDb({ 'orders/o1': { stage: 'pago_confirmado', customerEmail: 'cliente@example.com' } });
    getDb.mockReturnValue(db);
    process.env.RESEND_API_KEY = 'test-key';

    await POST(makeRequest({ adminPassword: 'secreto', orderId: 'o1', stage: 'en_desarrollo' }));

    expect(mockResendSend).toHaveBeenCalledTimes(1);
    expect(mockResendSend.mock.calls[0][0].to).toBe('cliente@example.com');
  });

  it('no manda email si el pedido no tiene customerEmail, pero igual actualiza la etapa', async () => {
    const { db, docs } = createFakeDb({ 'orders/o1': { stage: 'pago_confirmado' } });
    getDb.mockReturnValue(db);
    process.env.RESEND_API_KEY = 'test-key';

    const res = await POST(makeRequest({ adminPassword: 'secreto', orderId: 'o1', stage: 'en_desarrollo' }));

    expect(res.status).toBe(200);
    expect(docs['orders/o1'].stage).toBe('en_desarrollo');
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});
