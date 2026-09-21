import { describe, it, expect, vi } from 'vitest';
import { buildOAuth1Header, postToX, xCredsFromEnv } from './xClient.mjs';

// Ejemplo oficial de firma de la doc de X ("Creating a signature"), que usa parámetros
// de form; acá se valida el formato de la cabecera y el determinismo con nonce/timestamp fijos.
const creds = { apiKey: 'ck', apiSecret: 'cs', accessToken: 'at', accessSecret: 'as' };

describe('buildOAuth1Header', () => {
  it('arma la cabecera con los campos oauth_* y una firma HMAC-SHA1 en base64', () => {
    const h = buildOAuth1Header({ method: 'POST', url: 'https://api.twitter.com/2/tweets', creds, nonce: 'n1', timestamp: 1700000000 });
    expect(h.startsWith('OAuth ')).toBe(true);
    expect(h).toContain('oauth_consumer_key="ck"');
    expect(h).toContain('oauth_token="at"');
    expect(h).toContain('oauth_nonce="n1"');
    expect(h).toContain('oauth_timestamp="1700000000"');
    expect(h).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(h).toMatch(/oauth_signature="[A-Za-z0-9%]+"/);
  });

  it('es determinista con el mismo nonce/timestamp y cambia si cambia el secreto', () => {
    const args = { method: 'POST', url: 'https://api.twitter.com/2/tweets', nonce: 'n1', timestamp: 1 };
    const a = buildOAuth1Header({ ...args, creds });
    expect(buildOAuth1Header({ ...args, creds })).toBe(a);
    expect(buildOAuth1Header({ ...args, creds: { ...creds, accessSecret: 'otro' } })).not.toBe(a);
  });
});

describe('xCredsFromEnv', () => {
  it('devuelve null si falta alguna variable', () => {
    expect(xCredsFromEnv({ X_API_KEY: 'a', X_API_SECRET: 'b', X_ACCESS_TOKEN: 'c' })).toBeNull();
  });
  it('devuelve las cuatro credenciales si están todas', () => {
    expect(xCredsFromEnv({ X_API_KEY: 'a', X_API_SECRET: 'b', X_ACCESS_TOKEN: 'c', X_ACCESS_SECRET: 'd' }))
      .toEqual({ apiKey: 'a', apiSecret: 'b', accessToken: 'c', accessSecret: 'd' });
  });
});

describe('postToX', () => {
  it('hace POST JSON a /2/tweets con Authorization y devuelve el id', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ data: { id: '123' } }) }));
    const id = await postToX('hola', { creds, fetchImpl });
    expect(id).toBe('123');
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.twitter.com/2/tweets');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toMatch(/^OAuth /);
    expect(JSON.parse(opts.body)).toEqual({ text: 'hola' });
  });

  it('lanza con el status y el detalle si X rechaza', async () => {
    const fetchImpl = async () => ({ ok: false, status: 402, text: async () => 'CreditsDepleted' });
    await expect(postToX('hola', { creds, fetchImpl })).rejects.toThrow('X 402: CreditsDepleted');
  });

  it('lanza sin credenciales, sin llamar a la red', async () => {
    const fetchImpl = vi.fn();
    await expect(postToX('hola', { creds: null, fetchImpl })).rejects.toThrow('no configuradas');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
