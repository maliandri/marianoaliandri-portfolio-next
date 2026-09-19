import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));

import { getDb } from '@/lib/firebase-admin';
import { PATCH } from './route.js';

function makeRequest(body) {
  return { json: async () => body };
}

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
