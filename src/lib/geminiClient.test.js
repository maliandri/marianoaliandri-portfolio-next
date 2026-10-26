import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini } from './geminiClient';

const KEYS = ['GEMINI_API_KEY_1', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5', 'GEMINI_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY'];
const ok = (text) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) });
const fail = (status, message) => ({ ok: false, status, json: async () => ({ error: { message } }) });
const keyOf = (call) => new URL(call[0]).searchParams.get('key');

describe('callGemini — rotación de keys', () => {
  beforeEach(() => {
    for (const k of KEYS) delete process.env[k];
    process.env.GEMINI_API_KEY_1 = 'k1';
    process.env.GEMINI_API_KEY_2 = 'k2';
    process.env.GEMINI_API_KEY_3 = 'k3';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('una key bloqueada (403) pasa a la siguiente', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(fail(403, 'Requests to this API generativelanguage.googleapis.com ... are blocked.'))
      .mockResolvedValueOnce(ok('hola'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await callGemini('p')).toBe('hola');
    expect(fetchMock.mock.calls.map(keyOf)).toEqual(['k1', 'k2']);
  });

  it('una key inválida (400 API key not valid) o 401 pasa a la siguiente', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(fail(400, 'API key not valid. Please pass a valid API key.'))
      .mockResolvedValueOnce(fail(401, 'Unauthorized'))
      .mockResolvedValueOnce(ok('listo'));
    vi.stubGlobal('fetch', fetchMock);
    expect(await callGemini('p')).toBe('listo');
    expect(fetchMock.mock.calls.map(keyOf)).toEqual(['k1', 'k2', 'k3']);
  });

  it('un error del pedido que no es de la key (400 de otra cosa) no prueba las demás', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fail(400, 'Invalid JSON payload received.'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(callGemini('p')).rejects.toThrow('Invalid JSON payload');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si todas fallan por key o cuota, avisa que fallaron todas', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(fail(403, 'blocked'))
      .mockResolvedValueOnce(fail(429, 'quota'))
      .mockResolvedValueOnce(fail(403, 'blocked'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(callGemini('p')).rejects.toThrow(/Todas las Gemini API keys/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
