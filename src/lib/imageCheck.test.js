import { describe, it, expect, vi, afterEach } from 'vitest';
import { imageIsReachable } from './imageCheck';

const res = (ok, status, type) => ({ ok, status, headers: { get: () => type }, body: { cancel: () => {} } });

describe('imageIsReachable', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ok con 200 image/*', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(true, 200, 'image/png')));
    expect(await imageIsReachable('https://x')).toEqual({ ok: true, detail: '' });
  });

  it('falla con content-type que no es imagen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(true, 200, 'text/html')));
    expect(await imageIsReachable('https://x')).toEqual({ ok: false, detail: 'content-type text/html' });
  });

  it('falla con HTTP de error o excepción', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(false, 502, 'image/png')));
    expect(await imageIsReachable('https://x')).toEqual({ ok: false, detail: 'HTTP 502' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    expect(await imageIsReachable('https://x')).toEqual({ ok: false, detail: 'timeout' });
  });
});
