import { describe, it, expect } from 'vitest';
import { checkInstagram, checkMercadoPago, tokenExpiryProblems } from './healthCheck';

const DAY = 86400;
const NOW = 1_800_000_000_000;
const s = NOW / 1000;
const json = body => async () => ({ ok: true, json: async () => body });

describe('tokenExpiryProblems', () => {
  it('0 = no vence; avisa con 7 días o menos', () => {
    expect(tokenExpiryProblems({ expires_at: 0, data_access_expires_at: s + 30 * DAY }, NOW)).toEqual([]);
    const p = tokenExpiryProblems({ expires_at: 0, data_access_expires_at: s + 5 * DAY + 100 }, NOW);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('vence en 5 días');
    expect(tokenExpiryProblems({ expires_at: s - DAY }, NOW)[0]).toContain('venció');
  });
});

describe('checkInstagram', () => {
  const env = { IG_ACCESS_TOKEN: 't', IG_USER_ID: '1' };

  it('token que no sirve → problema', async () => {
    const r = await checkInstagram({ env, now: NOW, fetchImpl: json({ error: { message: 'Session has expired' } }) });
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain('Session has expired');
  });

  it('token sano que no vence → ok', async () => {
    const fetchImpl = async url => ({ json: async () => (url.includes('debug_token')
      ? { data: { is_valid: true, expires_at: 0, data_access_expires_at: s + 60 * DAY } }
      : { username: 'marianoaliandri' }) });
    expect(await checkInstagram({ env, now: NOW, fetchImpl })).toMatchObject({ ok: true, problems: [], username: 'marianoaliandri' });
  });

  it('si debug_token falla pero el token sirve, no alerta', async () => {
    const fetchImpl = async url => ({ json: async () => (url.includes('debug_token') ? { error: { message: 'no' } } : { username: 'x' }) });
    expect((await checkInstagram({ env, now: NOW, fetchImpl })).ok).toBe(true);
  });

  it('sin variables → problema', async () => {
    expect((await checkInstagram({ env: {} })).ok).toBe(false);
  });
});

describe('checkMercadoPago', () => {
  it('401 → problema; 200 → ok', async () => {
    const env = { MERCADOPAGO_ACCESS_TOKEN: 'x' };
    expect((await checkMercadoPago({ env, fetchImpl: async () => ({ ok: false, status: 401 }) })).problems[0]).toContain('401');
    expect((await checkMercadoPago({ env, fetchImpl: async () => ({ ok: true }) })).ok).toBe(true);
  });
});
