import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
// Se mockea solo la verificación del idToken; requireAdmin (lib/adminAuth.js) corre real.
vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { GET, POST, PATCH, DELETE } from './route.js';

const ADMIN = { uid: 'admin-uid', email: 'admin@example.com', emailVerified: true };
const OTHER = { uid: 'other-uid', email: 'otro@example.com', emailVerified: true };

function makeRequest(body) {
  return { json: async () => body };
}

beforeEach(() => {
  process.env.ADMIN_EMAIL = 'admin@example.com';
  getUserFromRequest.mockResolvedValue(ADMIN);
});

describe('autenticación de /api/noticias/topics', () => {
  beforeEach(() => vi.clearAllMocks());

  const handlers = [
    ['GET', () => GET(makeRequest())],
    ['POST', () => POST(makeRequest({ label: 'x' }))],
    ['PATCH', () => PATCH(makeRequest({ id: 't1', activo: false }))],
    ['DELETE', () => DELETE(makeRequest({ id: 't1' }))],
  ];

  describe.each(handlers)('%s', (_name, call) => {
    it('401 sin token válido, sin tocar Firestore', async () => {
      getUserFromRequest.mockResolvedValue(null);
      const res = await call();
      expect(res.status).toBe(401);
      expect(getDb).not.toHaveBeenCalled();
    });

    it('403 con usuario que no es admin, sin tocar Firestore', async () => {
      getUserFromRequest.mockResolvedValue(OTHER);
      const res = await call();
      expect(res.status).toBe(403);
      expect(getDb).not.toHaveBeenCalled();
    });

    it('403 si el email del admin no está verificado', async () => {
      getUserFromRequest.mockResolvedValue({ ...ADMIN, emailVerified: false });
      const res = await call();
      expect(res.status).toBe(403);
    });

    it('403 si ADMIN_EMAIL no está seteada (falla cerrado)', async () => {
      delete process.env.ADMIN_EMAIL;
      const res = await call();
      expect(res.status).toBe(403);
    });
  });

  it('GET con admin devuelve la lista de tópicos', async () => {
    getDb.mockReturnValue({
      collection: () => ({
        orderBy: () => ({
          async get() {
            return { docs: [{ id: 't1', data: () => ({ label: 'SEO', toneInstructions: 'directo' }) }] };
          },
        }),
      }),
    });
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.topics[0]).toMatchObject({ id: 't1', toneInstructions: 'directo' });
  });

  it('GET: usarFoto es true por default (tópicos viejos sin el campo) y respeta false', async () => {
    getDb.mockReturnValue({
      collection: () => ({
        orderBy: () => ({
          async get() {
            return {
              docs: [
                { id: 't1', data: () => ({ label: 'viejo' }) },
                { id: 't2', data: () => ({ label: 'sin foto', usarFoto: false }) },
              ],
            };
          },
        }),
      }),
    });
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.topics[0].usarFoto).toBe(true);
    expect(data.topics[1].usarFoto).toBe(false);
  });

  it('GET: destino es fb_ig por default y respeta el guardado', async () => {
    getDb.mockReturnValue({
      collection: () => ({
        orderBy: () => ({
          async get() {
            return {
              docs: [
                { id: 't1', data: () => ({ label: 'viejo' }) },
                { id: 't2', data: () => ({ label: 'trabajo remoto', destino: 'linkedin' }) },
              ],
            };
          },
        }),
      }),
    });
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(data.topics[0].destino).toBe('fb_ig');
    expect(data.topics[1].destino).toBe('linkedin');
  });

  it('GET: maxPorCorrida es 2 por default y respeta el guardado', async () => {
    getDb.mockReturnValue({
      collection: () => ({
        orderBy: () => ({
          async get() {
            return {
              docs: [
                { id: 't1', data: () => ({ label: 'viejo' }) },
                { id: 't2', data: () => ({ label: 'de a una', maxPorCorrida: 1 }) },
                { id: 't3', data: () => ({ label: 'dato roto', maxPorCorrida: 99 }) },
              ],
            };
          },
        }),
      }),
    });
    const res = await GET(makeRequest());
    const data = await res.json();
    // 99 (dato cargado a mano, fuera de rango) se limita a 5, igual que hace el bot
    expect(data.topics.map(t => t.maxPorCorrida)).toEqual([2, 1, 5]);
  });
});

// Firestore fake en memoria — mismo espíritu que el de
// src/app/api/lead-finder-pro/run/route.test.js, pero con lo que esta ruta
// necesita: doc.update/delete en noticias_topics, where+get+batch en noticias.
function createFakeDb(topics = {}, notes = {}) {
  const state = { topics: { ...topics }, notes: { ...notes } };

  function topicDocRef(id) {
    return {
      async get() {
        const data = state.topics[id];
        return { exists: data !== undefined, data: () => data };
      },
      async update(patch) {
        state.topics[id] = { ...(state.topics[id] || {}), ...patch };
      },
      async delete() {
        delete state.topics[id];
      },
    };
  }

  function noteDocRef(id) {
    return { id, delete() { delete state.notes[id]; } };
  }

  return {
    state,
    db: {
      collection(name) {
        if (name === 'noticias_topics') return { doc: (id) => topicDocRef(id) };
        if (name === 'noticias') {
          return {
            where(field, op, value) {
              if (op !== '==') throw new Error('fake solo soporta ==');
              const matches = Object.entries(state.notes)
                .filter(([, data]) => data[field] === value)
                .map(([id]) => ({ id, ref: noteDocRef(id) }));
              return { async get() { return { docs: matches }; } };
            },
          };
        }
        throw new Error(`fake db: colección no soportada "${name}"`);
      },
      batch() {
        const ops = [];
        return {
          delete(ref) { ops.push(ref); },
          async commit() { for (const ref of ops) ref.delete(); },
        };
      },
    },
  };
}

describe('PATCH /api/noticias/topics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('actualiza toneInstructions', async () => {
    const { db, state } = createFakeDb({ t1: { label: 'SEO', activo: true } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1', toneInstructions: 'tono directo' }));
    expect(res.status).toBe(200);
    expect(state.topics.t1.toneInstructions).toBe('tono directo');
  });

  it('sigue aceptando solo activo (compatibilidad)', async () => {
    const { db, state } = createFakeDb({ t1: { label: 'SEO', activo: true } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1', activo: false }));
    expect(res.status).toBe(200);
    expect(state.topics.t1.activo).toBe(false);
  });

  it('actualiza usarFoto', async () => {
    const { db, state } = createFakeDb({ t1: { label: 'SEO', activo: true } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1', usarFoto: false }));
    expect(res.status).toBe(200);
    expect(state.topics.t1.usarFoto).toBe(false);
  });

  it('actualiza destino con un valor válido', async () => {
    const { db, state } = createFakeDb({ t1: { label: 'trabajo remoto', activo: true } });
    getDb.mockReturnValue(db);
    for (const destino of ['fb_ig', 'linkedin', 'todas', 'x']) {
      const res = await PATCH(makeRequest({ id: 't1', destino }));
      expect(res.status).toBe(200);
      expect(state.topics.t1.destino).toBe(destino);
    }
  });

  it('actualiza maxPorCorrida con un entero de 1 a 5', async () => {
    const { db, state } = createFakeDb({ t1: { label: 'SEO', activo: true } });
    getDb.mockReturnValue(db);
    for (const n of [1, 2, 5]) {
      const res = await PATCH(makeRequest({ id: 't1', maxPorCorrida: n }));
      expect(res.status).toBe(200);
      expect(state.topics.t1.maxPorCorrida).toBe(n);
    }
  });

  it.each([0, 6, 1.5, '2', null])('rechaza maxPorCorrida inválido (%s)', async (bad) => {
    const { db } = createFakeDb({ t1: { label: 'SEO' } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1', maxPorCorrida: bad }));
    expect(res.status).toBe(400);
  });

  it('actualiza query (con trim) y rechaza vacía o demasiado larga', async () => {
    const { db, state } = createFakeDb({ t1: { label: 'SEO', activo: true } });
    getDb.mockReturnValue(db);
    const ok = await PATCH(makeRequest({ id: 't1', query: '  "trabajo remoto" OR teletrabajo ' }));
    expect(ok.status).toBe(200);
    expect(state.topics.t1.query).toBe('"trabajo remoto" OR teletrabajo');
    for (const bad of ['', '   ', 'x'.repeat(201), 5]) {
      const res = await PATCH(makeRequest({ id: 't1', query: bad }));
      expect(res.status).toBe(400);
    }
  });

  it('rechaza un destino que no existe', async () => {
    const { db } = createFakeDb({ t1: { label: 'SEO' } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1', destino: 'twitter' }));
    expect(res.status).toBe(400);
  });

  it('rechaza usarFoto que no sea boolean', async () => {
    const { db } = createFakeDb({ t1: { label: 'SEO' } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1', usarFoto: 'no' }));
    expect(res.status).toBe(400);
  });

  it('rechaza si no manda ni activo ni toneInstructions ni usarFoto', async () => {
    const { db } = createFakeDb({ t1: { label: 'SEO' } });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ id: 't1' }));
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/noticias/topics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('borra el tópico y sus notas, sin tocar notas de otros tópicos', async () => {
    const { db, state } = createFakeDb(
      { t1: { label: 'SEO' }, t2: { label: 'Neuquén' } },
      {
        n1: { topicId: 't1', title: 'nota 1' },
        n2: { topicId: 't1', title: 'nota 2' },
        n3: { topicId: 't2', title: 'nota de otro tópico' },
      }
    );
    getDb.mockReturnValue(db);

    const res = await DELETE(makeRequest({ id: 't1' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deletedCount).toBe(2);
    expect(state.topics.t1).toBeUndefined();
    expect(state.topics.t2).toBeDefined();
    expect(state.notes.n1).toBeUndefined();
    expect(state.notes.n2).toBeUndefined();
    expect(state.notes.n3).toBeDefined();
  });

  it('devuelve 404 si el tópico no existe', async () => {
    const { db } = createFakeDb({});
    getDb.mockReturnValue(db);
    const res = await DELETE(makeRequest({ id: 'no-existe' }));
    expect(res.status).toBe(404);
  });
});
