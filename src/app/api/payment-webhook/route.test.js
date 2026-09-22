import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: {
        increment: (n) => ({ __op: 'increment', n }),
        serverTimestamp: () => ({ __op: 'serverTimestamp' }),
      },
    },
  },
  getDb: vi.fn(),
}));

// vitest exige el prefijo "mock" para referenciar variables de afuera dentro del factory
// de vi.mock (si no, el hoisting del mock las deja undefined).
// El route hace "new Payment(...)" / "new Resend(...)" -- mockImplementation necesita una
// function tradicional acá, una arrow function no es "constructible" y tira TypeError.
const mockPaymentGet = vi.fn();
vi.mock('mercadopago', () => ({
  MercadoPagoConfig: vi.fn(),
  Payment: vi.fn().mockImplementation(function () { return { get: mockPaymentGet }; }),
}));

const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'email-1' } });
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function () { return { emails: { send: mockResendSend } }; }),
}));

import { getDb } from '@/lib/firebase-admin';
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

// Mismo fake en memoria que src/app/api/lead-finder-pro/run/route.test.js.
function createFakeDb(initialDocs = {}) {
  const docs = { ...initialDocs };

  function makeDocRef(path) {
    return {
      async get() {
        const data = docs[path];
        return { exists: data !== undefined, data: () => data };
      },
      async set(data, opts) {
        const prev = docs[path] || {};
        docs[path] = opts?.merge ? resolveFieldValues(data, prev) : resolveFieldValues(data, {});
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
  };
}

function makeRequest(body) {
  return {
    text: async () => JSON.stringify(body),
    headers: { get: () => null }, // sin x-signature/x-request-id -> verifyWebhookSignature deja pasar
    url: 'https://marianoaliandri.com.ar/api/payment-webhook/',
  };
}

const WEBHOOK_BODY = { type: 'payment', data: { id: '180325834040' } };

describe('POST /api/payment-webhook — Lead Finder Pro', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResendSend.mockResolvedValue({ data: { id: 'email-1' } });
  });

  it('acredita los créditos cuando MP devuelve la metadata en snake_case (plan_id)', async () => {
    // Así la devuelve MP de verdad: mandamos "planId" al crear la preferencia pero la API
    // la reescribe a "plan_id" -- este es el bug real que dejó un pago aprobado sin acreditar.
    mockPaymentGet.mockResolvedValue({
      id: '180325834040',
      status: 'approved',
      transaction_amount: 3499,
      payer: { email: 'clienta@example.com' },
      metadata: { type: 'leadfinder_plan', uid: 'user-1', plan_id: 'plan-starter-50', credits: 50 },
    });
    const { db, docs } = createFakeDb();
    getDb.mockReturnValue(db);

    const res = await POST(makeRequest(WEBHOOK_BODY));

    expect(res.status).toBe(200);
    expect(docs['leadfinder_entitlements/user-1'].credits).toBe(50);
    expect(docs['leadfinder_entitlements/user-1'].planId).toBe('plan-starter-50');
    expect(docs['leadfinder_processed_payments/180325834040']).toBeDefined();
    expect(mockResendSend).not.toHaveBeenCalled(); // sin error, no hace falta avisar

    // Tiene que quedar visible en /mis-compras (esa pantalla lee "orders" por userId/email)
    const order = docs['orders/LFP-180325834040'];
    expect(order).toBeDefined();
    expect(order.userId).toBe('user-1');
    expect(order.customerEmail).toBe('clienta@example.com');
    expect(order.status).toBe('approved');
  });

  it('también acredita si MP devolviera la metadata en camelCase (compatibilidad)', async () => {
    mockPaymentGet.mockResolvedValue({
      id: 'pay-2',
      status: 'approved',
      transaction_amount: 3499,
      metadata: { type: 'leadfinder_plan', uid: 'user-2', planId: 'plan-starter-50', credits: 50 },
    });
    const { db, docs } = createFakeDb();
    getDb.mockReturnValue(db);

    await POST(makeRequest({ type: 'payment', data: { id: 'pay-2' } }));

    expect(docs['leadfinder_entitlements/user-2'].credits).toBe(50);
  });

  it('es idempotente: un mismo paymentId no acredita dos veces', async () => {
    mockPaymentGet.mockResolvedValue({
      id: '180325834040',
      status: 'approved',
      transaction_amount: 3499,
      metadata: { type: 'leadfinder_plan', uid: 'user-1', plan_id: 'plan-starter-50', credits: 50 },
    });
    const { db, docs } = createFakeDb();
    getDb.mockReturnValue(db);

    await POST(makeRequest(WEBHOOK_BODY));
    await POST(makeRequest(WEBHOOK_BODY)); // MP reintenta el mismo webhook

    expect(docs['leadfinder_entitlements/user-1'].credits).toBe(50); // no 100
  });

  it('si falla la acreditación, avisa por email a yo@marianoaliandri.com.ar sin romper el webhook', async () => {
    mockPaymentGet.mockResolvedValue({
      id: 'pay-3',
      status: 'approved',
      transaction_amount: 3499,
      metadata: { type: 'leadfinder_plan', uid: 'user-3', plan_id: 'plan-x', credits: 50 },
    });
    getDb.mockReturnValue(null); // simula getDb() fallando (cold start, credenciales, etc.)
    process.env.RESEND_API_KEY = 'test-key';

    const res = await POST(makeRequest({ type: 'payment', data: { id: 'pay-3' } }));

    expect(res.status).toBe(200); // el webhook igual responde 200 (MP no debe reintentar infinito)
    expect(mockResendSend).toHaveBeenCalledTimes(1);
    const call = mockResendSend.mock.calls[0][0];
    expect(call.to).toBe('yo@marianoaliandri.com.ar');
    expect(call.subject).toContain('pay-3');
  });

  it('no acredita nada si falta credits en la metadata', async () => {
    mockPaymentGet.mockResolvedValue({
      id: 'pay-4',
      status: 'approved',
      metadata: { type: 'leadfinder_plan', uid: 'user-4', plan_id: 'plan-x' },
    });
    const { db, docs } = createFakeDb();
    getDb.mockReturnValue(db);

    await POST(makeRequest({ type: 'payment', data: { id: 'pay-4' } }));

    expect(docs['leadfinder_entitlements/user-4']).toBeUndefined();
  });
});
