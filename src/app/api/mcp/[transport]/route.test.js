import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { getDb } from '@/lib/firebase-admin';
import { createFakeDb } from '@/test/fakeDb';
import { registerClient, createAuthCode, exchangeCode } from '@/lib/mcp/oauth';
import { POST } from './route.js';

const URL_MCP = 'https://marianoaliandri.com.ar/api/mcp/mcp/';
const rpc = (body, token) => new Request(URL_MCP, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
  body: JSON.stringify(body),
});

async function validToken(db) {
  const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
  const { body } = await registerClient(db, { redirect_uris: [CLAUDE] });
  const code = await createAuthCode(db, {
    clientId: body.client_id, redirectUri: CLAUDE, codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    scope: 'mcp', uid: 'u1', email: 'mariano@example.com',
  });
  const ex = await exchangeCode(db, { code, clientId: body.client_id, redirectUri: CLAUDE, codeVerifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk' });
  return ex.body.access_token;
}

describe('/api/mcp/[transport]', () => {
  let fake;
  beforeEach(() => {
    process.env.MCP_ENABLED = 'true';
    process.env.ADMIN_EMAIL = 'mariano@example.com';
    process.env.MCP_BASE_URL = 'https://marianoaliandri.com.ar';
    fake = createFakeDb();
    getDb.mockReturnValue(fake.db);
  });

  it('sin token → 401 con puntero a la metadata', async () => {
    const res = await POST(rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain(
      'resource_metadata="https://marianoaliandri.com.ar/.well-known/oauth-protected-resource/"');
  });

  it('token basura → 401', async () => {
    const res = await POST(rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'x'.repeat(43)));
    expect(res.status).toBe(401);
  });

  it('apagado → 503', async () => {
    process.env.MCP_ENABLED = '';
    expect((await POST(rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' }))).status).toBe(503);
  });

  it('con token válido responde initialize', async () => {
    const token = await validToken(fake.db);
    const res = await POST(rpc({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } },
    }, token));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('marianoaliandri');
  });
});
