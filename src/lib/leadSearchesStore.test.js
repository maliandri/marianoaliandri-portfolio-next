import { describe, it, expect, vi } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { createFakeDb } from '@/test/fakeDb';
import { listSearches, getSearch, saveSearch } from './leadSearchesStore';

function seed(n) {
  const docs = {};
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(2026, 9, 1, 0, i));
    docs[`leadfinder_searches/u1/items/s${i}`] = {
      ciudades: ['Neuquén'], tipos: [], terminos: ['x'], radioKm: 10, results: [{ id: 'a' }],
      createdAt: { __ts: d.getTime() * 1000, toDate: () => d },
    };
  }
  return createFakeDb(docs);
}

describe('leadSearchesStore', () => {
  it('pagina de a 20 con cursor', async () => {
    const { db } = seed(25);
    const p1 = await listSearches(db, 'u1', { limit: 20 });
    expect(p1.items).toHaveLength(20);
    expect(p1.items[0].id).toBe('s24');
    expect(p1.nextCursor).toBeTruthy();
    const p2 = await listSearches(db, 'u1', { limit: 20, cursor: p1.nextCursor });
    expect(p2.items).toHaveLength(5);
    expect(p2.items[0].id).toBe('s4');
    expect(p2.nextCursor).toBeNull();
  });

  it('getSearch devuelve null si no existe', async () => {
    const { db } = seed(1);
    expect(await getSearch(db, 'u1', 'nope')).toBeNull();
    expect((await getSearch(db, 'u1', 's0')).results).toHaveLength(1);
  });

  it('origen admin solo para la cuenta admin y guarda via', async () => {
    const { db, docs } = createFakeDb();
    const id = await saveSearch(db, 'u1', { origen: 'admin', via: 'mcp', results: [{ id: 'a' }] }, { isAdmin: false });
    const saved = docs[`leadfinder_searches/u1/items/${id}`];
    expect(saved.origen).toBe('cliente');
    expect(saved.via).toBe('mcp');
    const id2 = await saveSearch(db, 'u1', { origen: 'admin', results: [{ id: 'a' }] }, { isAdmin: true });
    expect(docs[`leadfinder_searches/u1/items/${id2}`].origen).toBe('admin');
    expect(docs[`leadfinder_searches/u1/items/${id2}`].via).toBeUndefined();
  });
});
