import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { getDb } from '@/lib/firebase-admin';
import { createFakeDb } from '@/test/fakeDb';
import { unsubscribeUrl } from '@/lib/emailGuards';
import { POST } from './route.js';

const req = (body) => ({ json: async () => body, headers: new Headers() });

describe('POST /api/email-baja', () => {
  beforeEach(() => { process.env.EMAIL_UNSUBSCRIBE_SECRET = 'secreto'; });

  it('con token inválido responde 400 y no guarda nada', async () => {
    const fake = createFakeDb();
    getDb.mockReturnValue(fake.db);
    const res = await POST(req({ e: 'a@b.com', t: 'falso' }));
    expect(res.status).toBe(400);
    expect(Object.keys(fake.docs)).toHaveLength(0);
  });

  it('con token válido registra la baja', async () => {
    const fake = createFakeDb();
    getDb.mockReturnValue(fake.db);
    const t = new URL(unsubscribeUrl('a@b.com')).searchParams.get('t');
    const res = await POST(req({ e: 'a@b.com', t }));
    expect(res.status).toBe(200);
    expect(Object.values(fake.docs)[0]).toMatchObject({ email: 'a@b.com' });
  });
});
