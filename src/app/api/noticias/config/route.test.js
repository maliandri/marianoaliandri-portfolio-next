import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
// Se mockea solo la verificación del idToken; requireAdmin (lib/adminAuth.js) corre real.
vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { GET, PATCH } from './route.js';

const ADMIN = { uid: 'admin-uid', email: 'admin@example.com', emailVerified: true };
const OTHER = { uid: 'other-uid', email: 'otro@example.com', emailVerified: true };

function makeRequest(body) {
  return { json: async () => body };
}

beforeEach(() => {
  process.env.ADMIN_EMAIL = 'admin@example.com';
  getUserFromRequest.mockResolvedValue(ADMIN);
});

describe('autenticación de /api/noticias/config', () => {
  beforeEach(() => vi.clearAllMocks());

  const handlers = [
    ['GET', () => GET(makeRequest())],
    ['PATCH', () => PATCH(makeRequest({ active: false }))],
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
  });

  it('GET con admin devuelve la config', async () => {
    getDb.mockReturnValue({
      collection: () => ({
        doc: () => ({ async get() { return { exists: true, data: () => ({ active: false, dailyCap: 3 }) }; } }),
      }),
    });
    const res = await GET(makeRequest());
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toMatchObject({ active: false, dailyCap: 3 });
  });
});

function createFakeConfigDb(initial = {}) {
  const state = { settings: { ...initial } };
  return {
    state,
    db: {
      collection() {
        return {
          doc() {
            return {
              async get() { return { exists: true, data: () => state.settings }; },
              async set(patch) { Object.assign(state.settings, patch); },
            };
          },
        };
      },
    },
  };
}

const VALID_SCHEDULE = {
  lun: { enabled: true, startHour: 8, endHour: 23 },
  mar: { enabled: true, startHour: 8, endHour: 23 },
  mie: { enabled: true, startHour: 8, endHour: 23 },
  jue: { enabled: true, startHour: 8, endHour: 23 },
  vie: { enabled: true, startHour: 8, endHour: 23 },
  sab: { enabled: false, startHour: null, endHour: null },
  dom: { enabled: false, startHour: null, endHour: null },
};

describe('PATCH /api/noticias/config — schedule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('acepta un schedule válido', async () => {
    const { db, state } = createFakeConfigDb({ active: true, dailyCap: null });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ schedule: VALID_SCHEDULE }));
    expect(res.status).toBe(200);
    expect(state.settings.schedule).toEqual(VALID_SCHEDULE);
  });

  it('acepta schedule: null (vuelve a publicar sin restricción)', async () => {
    const { db, state } = createFakeConfigDb({ schedule: VALID_SCHEDULE });
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ schedule: null }));
    expect(res.status).toBe(200);
    expect(state.settings.schedule).toBeNull();
  });

  it('rechaza un schedule al que le falta un día', async () => {
    const { lun: _omitido, ...incompleto } = VALID_SCHEDULE;
    const { db } = createFakeConfigDb({});
    getDb.mockReturnValue(db);
    const res = await PATCH(makeRequest({ schedule: incompleto }));
    expect(res.status).toBe(400);
  });

  it('rechaza startHour fuera de rango (0-24)', async () => {
    const { db } = createFakeConfigDb({});
    getDb.mockReturnValue(db);
    const bad = { ...VALID_SCHEDULE, lun: { enabled: true, startHour: 25, endHour: 23 } };
    const res = await PATCH(makeRequest({ schedule: bad }));
    expect(res.status).toBe(400);
  });

  it('acepta endHour: 24 (hasta medianoche)', async () => {
    const { db, state } = createFakeConfigDb({});
    getDb.mockReturnValue(db);
    const ok = { ...VALID_SCHEDULE, vie: { enabled: true, startHour: 20, endHour: 24 } };
    const res = await PATCH(makeRequest({ schedule: ok }));
    expect(res.status).toBe(200);
    expect(state.settings.schedule.vie.endHour).toBe(24);
  });
});
