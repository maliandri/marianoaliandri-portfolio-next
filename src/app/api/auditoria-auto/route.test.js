import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));
vi.mock('@/lib/autoAuditRun', () => ({ loadConfig: vi.fn() }));

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { loadConfig } from '@/lib/autoAuditRun';
import { GET, PATCH } from './route.js';

const ADMIN = { uid: 'a', email: 'admin@example.com', emailVerified: true };
const OTHER = { uid: 'o', email: 'otro@example.com', emailVerified: true };
const req = (body) => ({ json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = 'admin@example.com';
  getUserFromRequest.mockResolvedValue(ADMIN);
});

describe('autenticación de /api/auditoria-auto', () => {
  const handlers = [['GET', () => GET(req())], ['PATCH', () => PATCH(req({ activo: true }))]];

  describe.each(handlers)('%s', (_n, call) => {
    it('401 sin token, sin tocar Firestore', async () => {
      getUserFromRequest.mockResolvedValue(null);
      expect((await call()).status).toBe(401);
      expect(getDb).not.toHaveBeenCalled();
    });
    it('403 si no es admin, sin tocar Firestore', async () => {
      getUserFromRequest.mockResolvedValue(OTHER);
      expect((await call()).status).toBe(403);
      expect(getDb).not.toHaveBeenCalled();
    });
  });
});

describe('GET /api/auditoria-auto', () => {
  it('devuelve la config sin el lock y los últimos runs con fecha ISO', async () => {
    loadConfig.mockResolvedValue({
      activo: true, ciudades: ['A'], rubros: [], networks: ['linkedin'], ultimaCorrida: {}, lock: { until: 5 },
    });
    getDb.mockReturnValue({
      collection: () => ({
        orderBy: () => ({
          limit: () => ({
            get: async () => ({
              docs: [{ id: 'r1', data: () => ({ estado: 'ok', auditados: 3, createdAt: { toDate: () => new Date('2026-10-09T12:00:00Z') } }) }],
            }),
          }),
        }),
      }),
    });
    const res = await GET(req());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.config).not.toHaveProperty('lock');
    expect(data.config.activo).toBe(true);
    expect(data.runs[0]).toMatchObject({ id: 'r1', estado: 'ok', createdAt: '2026-10-09T12:00:00.000Z' });
  });
});

describe('PATCH /api/auditoria-auto', () => {
  it('400 si el body es null, sin escribir', async () => {
    const set = vi.fn();
    getDb.mockReturnValue({ collection: () => ({ doc: () => ({ set }) }) });
    const res = await PATCH(req(null));
    expect(res.status).toBe(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('400 si el body es inválido, sin escribir', async () => {
    const set = vi.fn();
    getDb.mockReturnValue({ collection: () => ({ doc: () => ({ set }) }) });
    const res = await PATCH(req({ networks: ['tiktok'] }));
    expect(res.status).toBe(400);
    expect(set).not.toHaveBeenCalled();
  });

  it('guarda con merge cuando es válido', async () => {
    const set = vi.fn();
    getDb.mockReturnValue({ collection: () => ({ doc: () => ({ set }) }) });
    const res = await PATCH(req({ activo: true }));
    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith({ activo: true }, { merge: true });
  });
});
