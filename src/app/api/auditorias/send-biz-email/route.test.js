import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
vi.mock('@/lib/geminiClient', () => ({ callGemini: vi.fn() }));
const send = vi.fn();
vi.mock('resend', () => ({ Resend: vi.fn(function () { this.emails = { send }; }) }));
import { requireAdmin } from '@/lib/adminAuth';
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
});
