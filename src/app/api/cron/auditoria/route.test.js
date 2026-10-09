import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/authServer', () => ({ getUserFromRequest: vi.fn() }));
vi.mock('@/lib/autoAuditRun', () => ({ runAutoAudit: vi.fn() }));

import { getUserFromRequest } from '@/lib/authServer';
import { runAutoAudit } from '@/lib/autoAuditRun';
import { POST } from './route.js';

const ADMIN = { uid: 'a', email: 'admin@example.com', emailVerified: true };
const OTHER = { uid: 'o', email: 'otro@example.com', emailVerified: true };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAIL = 'admin@example.com';
  getUserFromRequest.mockResolvedValue(ADMIN);
});

describe('POST /api/cron/auditoria', () => {
  it('401 sin token válido, sin ejecutar', async () => {
    getUserFromRequest.mockResolvedValue(null);
    const res = await POST({});
    expect(res.status).toBe(401);
    expect(runAutoAudit).not.toHaveBeenCalled();
  });

  it('403 si no es admin, sin ejecutar', async () => {
    getUserFromRequest.mockResolvedValue(OTHER);
    const res = await POST({});
    expect(res.status).toBe(403);
    expect(runAutoAudit).not.toHaveBeenCalled();
  });

  it('admin: ejecuta con force:true y devuelve el resultado', async () => {
    runAutoAudit.mockResolvedValue({ estado: 'ok', auditoriaId: 'x', auditados: 3 });
    const res = await POST({});
    expect(res.status).toBe(200);
    expect(runAutoAudit).toHaveBeenCalledWith({ force: true });
    expect(await res.json()).toEqual({ ok: true, estado: 'ok', auditoriaId: 'x', auditados: 3 });
  });

  it('500 con el mensaje si runAutoAudit lanza', async () => {
    runAutoAudit.mockRejectedValue(new Error('DB no disponible'));
    const res = await POST({});
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('DB no disponible');
  });
});
