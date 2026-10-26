import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/makeSocial', () => ({ postToMakeSocial: vi.fn() }));
import { requireAdmin } from '@/lib/adminAuth';
import { postToMakeSocial } from '@/lib/makeSocial';
import { POST } from './route.js';

const req = (body) => ({ json: async () => body, headers: new Headers() });

describe('POST /api/publish-social', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin admin responde 401 y no llama a Make', async () => {
    requireAdmin.mockResolvedValue({ response: Response.json({ error: 'No autenticado' }, { status: 401 }) });
    const res = await POST(req({ text: 'x' }));
    expect(res.status).toBe(401);
    expect(postToMakeSocial).not.toHaveBeenCalled();
  });

  it('con admin reenvía el payload a Make', async () => {
    requireAdmin.mockResolvedValue({ user: { uid: 'a' } });
    const res = await POST(req({ text: 'x' }));
    expect(res.status).toBe(200);
    expect(postToMakeSocial).toHaveBeenCalledWith({ text: 'x' });
  });
});
