import { describe, it, expect, vi, beforeEach } from 'vitest';

// Venta por consulta: los precios de la tienda son solo para el admin.
const requireAdmin = vi.fn();
vi.mock('@/lib/adminAuth', () => ({ requireAdmin: (...a) => requireAdmin(...a) }));
vi.mock('@/lib/firebase-admin', () => ({ getDb: () => ({}) }));
vi.mock('@/lib/dolar', () => ({ dolarOficialVenta: async () => ({ cotizacion: 1000 }) }));
vi.mock('@/lib/tiendaCheckout', () => ({
  cargarCatalogo: async () => [{ id: 'base', priceUSD: 150, activo: true }],
  loadSenaPct: async () => 0.5,
}));

const { GET } = await import('./route.js');

describe('GET /api/tienda/precios', () => {
  beforeEach(() => requireAdmin.mockReset());

  it('sin admin no devuelve precios', async () => {
    requireAdmin.mockResolvedValue({ response: Response.json({ error: 'No autorizado' }, { status: 403 }) });
    const res = await GET(new Request('http://x/api/tienda/precios/'));
    expect([401, 403]).toContain(res.status);
    expect(await res.json()).not.toHaveProperty('precios');
  });

  it('con admin devuelve precios', async () => {
    requireAdmin.mockResolvedValue({ user: { uid: 'admin' } });
    const res = await GET(new Request('http://x/api/tienda/precios/'));
    expect(res.status).toBe(200);
    expect((await res.json()).precios).toEqual({ base: 150 });
  });
});
