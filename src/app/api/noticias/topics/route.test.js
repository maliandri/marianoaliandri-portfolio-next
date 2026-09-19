import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));

import { getDb } from '@/lib/firebase-admin';
import { PATCH, DELETE } from './route.js';

function makeRequest(body) {
  return { json: async () => body };
}

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

  it('rechaza si no manda ni activo ni toneInstructions', async () => {
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
