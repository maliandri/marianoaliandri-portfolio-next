import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
// Se mockea solo la verificación del idToken; requireAdmin (lib/adminAuth.js) corre real.
vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { GET } from './route.js';

const ADMIN = { uid: 'admin-uid', email: 'admin@example.com', emailVerified: true };

function makeRequest(query = '') {
  return { url: `https://marianoaliandri.com.ar/api/noticias${query}` };
}

function fakeDb(docs) {
  return {
    collection: () => ({
      orderBy: () => ({
        limit: () => ({
          async get() {
            return { docs: docs.map(([id, data]) => ({ id, data: () => data })) };
          },
        }),
      }),
    }),
  };
}

const DOCS = [
  ['n1', { title: 'Nota del sitio', status: 'published', makeError: null }],
  ['n2', { title: 'Nota solo para X', status: 'published', destino: 'x', visibleEnSitio: false }],
  ['n3', { title: 'Nota que falló', status: 'error', makeError: 'Cloudinary: boom' }],
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = 'admin@example.com';
  getDb.mockReturnValue(fakeDb(DOCS));
});

describe('GET /api/noticias?public=1 (superficies públicas)', () => {
  it('no requiere login, y no muestra ni las notas solo-X ni las que fallaron ni makeError', async () => {
    const res = await GET(makeRequest('?public=1'));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.noticias.map(n => n.id)).toEqual(['n1']);
    expect(data.noticias[0]).not.toHaveProperty('makeError');
    expect(getUserFromRequest).not.toHaveBeenCalled();
  });
});

describe('GET /api/noticias (log del admin)', () => {
  it('401 sin login: ya no es una API abierta que devuelva todo (incluidas las notas solo-X)', async () => {
    getUserFromRequest.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(getDb).not.toHaveBeenCalled();
  });

  it('403 con un usuario que no es admin', async () => {
    getUserFromRequest.mockResolvedValue({ uid: 'x', email: 'otro@example.com', emailVerified: true });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(getDb).not.toHaveBeenCalled();
  });

  it('con admin devuelve todo, incluidas las notas solo-X y los errores', async () => {
    getUserFromRequest.mockResolvedValue(ADMIN);
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.noticias.map(n => n.id)).toEqual(['n1', 'n2', 'n3']);
    expect(data.noticias[2].makeError).toBe('Cloudinary: boom');
    expect(data.noticias[1].destino).toBe('x');
  });
});
