import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('@/lib/firebase-admin', () => ({ getDb: vi.fn() }));
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { getDb } from '@/lib/firebase-admin';
import { createFakeDb } from '@/test/fakeDb';
import { registerClient, createAuthCode } from '@/lib/mcp/oauth';
import { POST } from './route.js';

const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

const form = (fields) => new Request('https://x/api/mcp-oauth/token/', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '1.2.3.4' },
  body: new URLSearchParams(fields).toString(),
});

describe('POST /api/mcp-oauth/token', () => {
  let fake;
  beforeEach(() => {
    process.env.MCP_ENABLED = 'true';
    process.env.ADMIN_EMAIL = 'mariano@example.com';
    fake = createFakeDb();
    getDb.mockReturnValue(fake.db);
  });

  it('canjea un código válido con no-store', async () => {
    const { body } = await registerClient(fake.db, { redirect_uris: [CLAUDE] });
    const code = await createAuthCode(fake.db, {
      clientId: body.client_id, redirectUri: CLAUDE, codeChallenge: CHALLENGE, scope: 'mcp', uid: 'u1', email: 'mariano@example.com',
    });
    const res = await POST(form({
      grant_type: 'authorization_code', code, client_id: body.client_id, redirect_uri: CLAUDE, code_verifier: VERIFIER,
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).token_type).toBe('Bearer');
  });

  it('JSON → 400 invalid_request', async () => {
    const res = await POST(new Request('https://x/api/mcp-oauth/token/', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  it('grant_type desconocido → unsupported_grant_type', async () => {
    const res = await POST(form({ grant_type: 'client_credentials' }));
    expect((await res.json()).error).toBe('unsupported_grant_type');
  });

  it('apagado → 503', async () => {
    process.env.MCP_ENABLED = '';
    const res = await POST(form({ grant_type: 'authorization_code' }));
    expect(res.status).toBe(503);
  });
});
