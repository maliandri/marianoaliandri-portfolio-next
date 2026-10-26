import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { createFakeDb } from '@/test/fakeDb';
import { hitRateLimit } from './rateLimit';
import { placesBudget, bumpMcpPlaces } from './placesBudget';

describe('hitRateLimit', () => {
  it('corta en la llamada 61 del mismo minuto y vuelve a abrir al siguiente', async () => {
    const { db } = createFakeDb();
    const now = Date.UTC(2026, 9, 26, 12, 0, 10);
    for (let i = 0; i < 60; i++) expect((await hitRateLimit(db, 'u1', { limit: 60, windowS: 60, now })).ok).toBe(true);
    const over = await hitRateLimit(db, 'u1', { limit: 60, windowS: 60, now });
    expect(over.ok).toBe(false);
    expect(over.retryAfterS).toBe(50);
    expect((await hitRateLimit(db, 'u1', { limit: 60, windowS: 60, now: now + 50_000 })).ok).toBe(true);
  });

  it('cada clave tiene su propio contador', async () => {
    const { db } = createFakeDb();
    const now = Date.UTC(2026, 9, 26, 12, 0, 0);
    await hitRateLimit(db, 'a', { limit: 1, windowS: 60, now });
    expect((await hitRateLimit(db, 'b', { limit: 1, windowS: 60, now })).ok).toBe(true);
    expect((await hitRateLimit(db, 'a', { limit: 1, windowS: 60, now })).ok).toBe(false);
  });
});

describe('placesBudget', () => {
  const now = new Date('2026-10-26T15:00:00Z');
  beforeEach(() => { delete process.env.MCP_PLACES_DAILY_CAP; });

  it('ok sin uso', async () => {
    const { db } = createFakeDb();
    expect(await placesBudget(db, { now })).toMatchObject({ ok: true, usedToday: 0, dailyCap: 150 });
  });

  it('corta por el tope diario del MCP', async () => {
    const { db } = createFakeDb({ 'leadfinder_usage/2026-10-26': { mcpPlaces: 150 } });
    expect(await placesBudget(db, { now })).toMatchObject({ ok: false, reason: 'diario' });
  });

  it('corta si algún SKU del mes pasa el 90 % del cupo gratis', async () => {
    const { db } = createFakeDb({
      'leadfinder_usage/2026-10-01': { getPlaceRequests: 500 },
      'leadfinder_usage/2026-10-20': { getPlaceRequests: 411 },
      'leadfinder_usage/2026-09-30': { getPlaceRequests: 900 },
    });
    const r = await placesBudget(db, { now });
    expect(r).toMatchObject({ ok: false, reason: 'mensual' });
    expect(r.monthPct).toBeCloseTo(91.1, 1);
  });

  it('bumpMcpPlaces suma en el día y respeta la env var', async () => {
    process.env.MCP_PLACES_DAILY_CAP = '2';
    const { db, docs } = createFakeDb();
    await bumpMcpPlaces(db, 1, now);
    await bumpMcpPlaces(db, 1, now);
    expect(docs['leadfinder_usage/2026-10-26'].mcpPlaces).toBe(2);
    expect(await placesBudget(db, { now })).toMatchObject({ ok: false, reason: 'diario', dailyCap: 2 });
  });
});
