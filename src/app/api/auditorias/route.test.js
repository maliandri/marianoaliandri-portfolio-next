import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/auditoriasStore', () => ({ saveAuditoria: vi.fn(async () => ({ id: 'new1' })) }));
import { requireAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/firebase-admin';
import { saveAuditoria } from '@/lib/auditoriasStore';
import { createFakeDb } from '@/test/fakeDb';
import { GET, POST, PATCH, DELETE } from './route.js';

const denied = { response: Response.json({ error: 'No autenticado' }, { status: 401 }) };
const req = (url, body) => ({ url, json: async () => body, headers: new Headers() });

describe('/api/auditorias', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GET sigue siendo público', async () => {
    getDb.mockReturnValue(createFakeDb({ 'auditorias/a': { title: 'T', publishedAt: null } }).db);
    const res = await GET(req('https://x/api/auditorias/?id=a'));
    expect(res.status).toBe(200);
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it('POST, PATCH y DELETE exigen admin', async () => {
    requireAdmin.mockResolvedValue(denied);
    expect((await POST(req('https://x/api/auditorias/', { title: 't', results: [1] }))).status).toBe(401);
    expect((await PATCH(req('https://x/api/auditorias/', { id: 'a' }))).status).toBe(401);
    expect((await DELETE(req('https://x/api/auditorias/?id=a', {}))).status).toBe(401);
    expect(saveAuditoria).not.toHaveBeenCalled();
  });

  it('POST con admin guarda', async () => {
    requireAdmin.mockResolvedValue({ user: { uid: 'a' } });
    const res = await POST(req('https://x/api/auditorias/', { title: 't', results: [1] }));
    expect(await res.json()).toEqual({ success: true, id: 'new1' });
  });
});
