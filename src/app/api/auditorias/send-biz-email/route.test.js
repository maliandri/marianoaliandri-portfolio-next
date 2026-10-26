import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('@/lib/geminiClient', () => ({ callGemini: vi.fn() }));
const send = vi.fn();
vi.mock('resend', () => ({ Resend: vi.fn(function () { this.emails = { send }; }) }));
import { requireAdmin } from '@/lib/adminAuth';
import { getDb } from '@/lib/firebase-admin';
import { createFakeDb } from '@/test/fakeDb';
import { POST } from './route.js';

const req = (body) => ({ json: async () => body, headers: new Headers() });

describe('POST /api/auditorias/send-biz-email', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin admin responde 401 y no manda nada', async () => {
    requireAdmin.mockResolvedValue({ response: Response.json({ error: 'No autenticado' }, { status: 401 }) });
    const res = await POST(req({ nombre: 'N', siteUrl: 'https://n.com', email: 'a@n.com' }));
    expect(res.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('no le escribe a quien pidió la baja (409) y sí a los demás, con link de baja', async () => {
    process.env.RESEND_API_KEY = 'k';
    process.env.EMAIL_UNSUBSCRIBE_SECRET = 'secreto';
    requireAdmin.mockResolvedValue({ user: { uid: 'a' } });
    const fake = createFakeDb({ 'email_bajas/b1': { email: 'a@n.com', dominios: ['n.com'] } });
    getDb.mockReturnValue(fake.db);
    const base = { nombre: 'N', siteUrl: 'https://n.com', emailText: 'hola', screenshotUrl: null };

    const res = await POST(req({ ...base, email: 'otra@n.com' }));
    expect(res.status).toBe(409);
    expect((await res.json()).bloqueo).toBe('baja');
    expect(send).not.toHaveBeenCalled();

    send.mockResolvedValue({ data: { id: 'r1' } });
    const ok = await POST(req({ ...base, siteUrl: 'https://otro.com', email: 'x@otro.com' }));
    expect(ok.status).toBe(200);
    expect(send.mock.calls[0][0].html).toContain('/baja/?e=x%40otro.com');
    const saved = Object.entries(fake.docs).find(([k]) => k.startsWith('sent_emails/'))[1];
    expect(saved).toMatchObject({ dominio: 'otro.com', origen: 'admin', resendId: 'r1' });
  });
});
