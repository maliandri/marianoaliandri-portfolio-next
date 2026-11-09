import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: vi.fn() }));
vi.mock('@/lib/makeSocial', () => ({ postToMakeSocial: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn(() => ({})) }));
vi.mock('@/lib/auditCardPublish', () => ({ withAuditCard: vi.fn() }));
import { requireAdmin } from '@/lib/adminAuth';
import { postToMakeSocial } from '@/lib/makeSocial';
import { withAuditCard } from '@/lib/auditCardPublish';
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

  it('una auditoría sale con la tarjeta como imagen', async () => {
    requireAdmin.mockResolvedValue({ user: { uid: 'a' } });
    const body = { text: 'x', imageUrl: 'https://api.microlink.io/..', metadata: { topic: 'auditoria' } };
    withAuditCard.mockResolvedValue({ ...body, imageUrl: 'https://res.cloudinary.com/card.png', url: 'https://res.cloudinary.com/card.png' });
    const res = await POST(req(body));
    expect(res.status).toBe(200);
    expect(postToMakeSocial.mock.calls[0][0].imageUrl).toBe('https://res.cloudinary.com/card.png');
  });

  it('si no se puede armar la tarjeta no publica nada', async () => {
    requireAdmin.mockResolvedValue({ user: { uid: 'a' } });
    withAuditCard.mockRejectedValue(new Error('No se pudo armar la imagen del informe: x'));
    const res = await POST(req({ text: 'x', metadata: { topic: 'auditoria' } }));
    expect(res.status).toBe(500);
    expect(postToMakeSocial).not.toHaveBeenCalled();
  });

  it('un post que no es de auditoría no pasa por la tarjeta', async () => {
    requireAdmin.mockResolvedValue({ user: { uid: 'a' } });
    await POST(req({ text: 'x', metadata: { topic: 'otro' } }));
    expect(withAuditCard).not.toHaveBeenCalled();
  });
});
