// src/app/api/lead-finder-pro/searches/route.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({ FieldValue: { serverTimestamp: () => 'TS' } }));

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { POST } from './route.js';

function fakeDb() {
  const added = [];
  const items = { add: async (doc) => { added.push(doc); return { id: `s${added.length}` }; } };
  return { added, db: { collection: () => ({ doc: () => ({ collection: () => items }) }) } };
}
const req = (body) => ({ json: async () => body });
const BASE = { ciudades: ['Neuquén, Argentina'], terminos: ['gomería'], tipos: [], radioKm: 10, results: [{ id: 'p1' }] };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = 'admin@example.com';
});

describe('POST /api/lead-finder-pro/searches', () => {
  it('guarda origen admin solo si el usuario es el admin', async () => {
    const { db, added } = fakeDb();
    getDb.mockReturnValue(db);
    getUserFromRequest.mockResolvedValue({ uid: 'a', email: 'admin@example.com' });
    await POST(req({ ...BASE, origen: 'admin' }));
    expect(added[0].origen).toBe('admin');
  });

  it('un cliente que manda origen admin queda como cliente', async () => {
    const { db, added } = fakeDb();
    getDb.mockReturnValue(db);
    getUserFromRequest.mockResolvedValue({ uid: 'c', email: 'cliente@example.com' });
    await POST(req({ ...BASE, origen: 'admin' }));
    expect(added[0].origen).toBe('cliente');
  });

  it('guarda el producto recortado', async () => {
    const { db, added } = fakeDb();
    getDb.mockReturnValue(db);
    getUserFromRequest.mockResolvedValue({ uid: 'c', email: 'cliente@example.com' });
    await POST(req({ ...BASE, perfil: 'empresa', producto: '  tornillos  ' }));
    expect(added[0].producto).toBe('tornillos');
  });

  it('normaliza perfil y stats', async () => {
    const { db, added } = fakeDb();
    getDb.mockReturnValue(db);
    getUserFromRequest.mockResolvedValue({ uid: 'c', email: 'cliente@example.com' });
    await POST(req({ ...BASE, perfil: 'raro', stats: { leads: 4, conWeb: '2', descartados: -1, otro: 9 } }));
    expect(added[0].perfil).toBe('dev');
    expect(added[0].stats).toEqual({ encontrados: 0, examinados: 0, leads: 4, conWeb: 0, descartados: 0 });
  });
});
