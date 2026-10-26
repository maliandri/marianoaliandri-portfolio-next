import { describe, it, expect, vi } from 'vitest';
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('@/app/api/lead-finder/route', () => ({ runLeadFinderAction: vi.fn() }));
import { runLeadFinderAction } from '@/app/api/lead-finder/route';
import { makeLeadFinderCall } from './leadFinderPro';

const USER = { uid: 'u1', email: 'a@b.c' };

describe('makeLeadFinderCall', () => {
  it('resuelve con el body si ok', async () => {
    runLeadFinderAction.mockResolvedValue(Response.json({ ok: true, places: [1] }));
    const call = makeLeadFinderCall(USER);
    expect(await call('searchText', { query: 'x' })).toMatchObject({ ok: true, places: [1] });
  });

  it('lanza con code cuando falla', async () => {
    runLeadFinderAction.mockResolvedValue(Response.json({ ok: false, error: 'boom', code: 'QUOTA_EXCEEDED' }));
    const call = makeLeadFinderCall(USER);
    await expect(call('searchText', {})).rejects.toMatchObject({ message: 'boom', code: 'QUOTA_EXCEEDED' });
  });

  it('acción no permitida devuelve 400 sin llamar a Google', async () => {
    runLeadFinderAction.mockClear();
    const call = makeLeadFinderCall(USER);
    await expect(call('borrarTodo', {})).rejects.toThrow('Acción no permitida');
    expect(runLeadFinderAction).not.toHaveBeenCalled();
  });
});
