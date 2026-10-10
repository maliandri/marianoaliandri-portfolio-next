import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ getDb: () => null }));

async function loadRoute() {
  vi.resetModules();
  return import('./route');
}

const req = (headers = {}) => new Request('https://x/api/analitica/refresh/', { headers });

describe('GET /api/analitica/refresh', () => {
  beforeEach(() => {
    vi.stubEnv('SERPAPI_KEY', 'serp-test');
    vi.stubEnv('CRON_SECRET', 'cron-test');
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('rechaza pedidos sin la clave del cron y no gasta créditos de SerpApi', async () => {
    const { GET } = await loadRoute();
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechaza una clave incorrecta', async () => {
    const { GET } = await loadRoute();
    const res = await GET(req({ authorization: 'Bearer otra' }));
    expect(res.status).toBe(401);
  });

  it('sin CRON_SECRET configurada no corre (falla cerrada)', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { GET } = await loadRoute();
    const res = await GET(req({ authorization: 'Bearer ' }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('CRON_SECRET no configurada');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('con la clave correcta pasa el control de acceso', async () => {
    const { GET } = await loadRoute();
    const res = await GET(req({ authorization: 'Bearer cron-test' }));
    // getDb() mockeado devuelve null → llega hasta "DB no disponible", después del control
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('DB no disponible');
  });
});
