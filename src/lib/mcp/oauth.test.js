import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('firebase-admin/firestore', async () => (await import('@/test/fakeDb')).firestoreMock);
import { createHash } from 'node:crypto';
import { createFakeDb } from '@/test/fakeDb';
import {
  isAllowedRedirect, verifyPkceS256, registerClient, validateAuthorizeRequest, createAuthCode,
  exchangeCode, refreshTokens, verifyAccessToken,
} from './oauth';

const CLAUDE = 'https://claude.ai/api/mcp/auth_callback';
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const ADMIN = { uid: 'u1', email: 'mariano@example.com' };

beforeEach(() => {
  process.env.ADMIN_EMAIL = 'Mariano@Example.com';
  process.env.MCP_BASE_URL = 'https://marianoaliandri.com.ar';
});

async function fullFlow(db, now = 1_000_000) {
  const reg = await registerClient(db, { redirect_uris: [CLAUDE], client_name: 'Claude' });
  const clientId = reg.body.client_id;
  const code = await createAuthCode(db, {
    clientId, redirectUri: CLAUDE, codeChallenge: CHALLENGE, scope: 'mcp', resource: null, ...ADMIN, now,
  });
  const ex = await exchangeCode(db, { code, clientId, redirectUri: CLAUDE, codeVerifier: VERIFIER, now: now + 1000 });
  return { clientId, code, ex };
}

describe('isAllowedRedirect', () => {
  it.each([
    [CLAUDE, true],
    ['https://claude.com/api/mcp/auth_callback', true],
    ['http://localhost:6274/oauth/callback', true],
    ['http://127.0.0.1:5000/cb', true],
    ['http://localhost/callback', true],
    ['https://evil.com/cb', false],
    ['http://localhost.evil.com/cb', false],
    ['https://claude.ai/otra-cosa', false],
    ['http://claude.ai/api/mcp/auth_callback', false],
    ['javascript:alert(1)', false],
  ])('%s → %s', (uri, ok) => expect(isAllowedRedirect(uri)).toBe(ok));
});

describe('PKCE S256', () => {
  it('vector del RFC 7636', () => {
    expect(verifyPkceS256(VERIFIER, CHALLENGE)).toBe(true);
    expect(verifyPkceS256(VERIFIER + 'x', CHALLENGE)).toBe(false);
    expect(verifyPkceS256('', CHALLENGE)).toBe(false);
  });
});

describe('registerClient', () => {
  it('rechaza redirects no permitidos', async () => {
    const { db } = createFakeDb();
    expect((await registerClient(db, { redirect_uris: ['https://evil.com/cb'] })).status).toBe(400);
    expect((await registerClient(db, { redirect_uris: [] })).status).toBe(400);
  });

  it('registra un cliente público', async () => {
    const { db } = createFakeDb();
    const r = await registerClient(db, { redirect_uris: [CLAUDE] });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ redirect_uris: [CLAUDE], token_endpoint_auth_method: 'none' });
    expect(r.body.client_id).toMatch(/^[\w-]{20,}$/);
  });
});

describe('validateAuthorizeRequest', () => {
  it('acepta loopback con otro puerto si se registró sin puerto', async () => {
    const { db } = createFakeDb();
    const { body } = await registerClient(db, { redirect_uris: ['http://localhost/callback'] });
    const ok = await validateAuthorizeRequest(db, {
      client_id: body.client_id, redirect_uri: 'http://localhost:3118/callback', response_type: 'code',
      code_challenge: CHALLENGE, code_challenge_method: 'S256',
    });
    expect(ok.ok).toBe(true);
  });

  it('rechaza redirect no registrado, sin PKCE S256 o resource ajeno', async () => {
    const { db } = createFakeDb();
    const { body } = await registerClient(db, { redirect_uris: [CLAUDE] });
    const base = { client_id: body.client_id, redirect_uri: CLAUDE, response_type: 'code', code_challenge: CHALLENGE, code_challenge_method: 'S256' };
    expect((await validateAuthorizeRequest(db, { ...base, redirect_uri: 'https://claude.com/api/mcp/auth_callback' })).ok).toBe(false);
    expect((await validateAuthorizeRequest(db, { ...base, code_challenge_method: 'plain' })).ok).toBe(false);
    expect((await validateAuthorizeRequest(db, { ...base, code_challenge: undefined })).ok).toBe(false);
    expect((await validateAuthorizeRequest(db, { ...base, client_id: 'nope' })).ok).toBe(false);
    expect((await validateAuthorizeRequest(db, { ...base, resource: 'https://otro.com/mcp' })).ok).toBe(false);
    expect((await validateAuthorizeRequest(db, { ...base, resource: 'https://marianoaliandri.com.ar/api/mcp/mcp' })).ok).toBe(true);
  });
});

describe('flujo completo', () => {
  it('register → code → token → verify', async () => {
    const { db } = createFakeDb();
    const { ex } = await fullFlow(db);
    expect(ex.status).toBe(200);
    expect(ex.body).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'mcp' });
    const info = await verifyAccessToken(db, ex.body.access_token, { now: 1_002_000 });
    expect(info).toMatchObject({ uid: 'u1', email: 'mariano@example.com' });
  });

  it('el código es de un solo uso', async () => {
    const { db } = createFakeDb();
    const { clientId, code } = await fullFlow(db);
    const again = await exchangeCode(db, { code, clientId, redirectUri: CLAUDE, codeVerifier: VERIFIER, now: 1_002_000 });
    expect(again).toMatchObject({ status: 400, body: { error: 'invalid_grant' } });
  });

  it('código vencido, verifier malo o redirect distinto → invalid_grant', async () => {
    const { db } = createFakeDb();
    const reg = await registerClient(db, { redirect_uris: [CLAUDE] });
    const mk = () => createAuthCode(db, { clientId: reg.body.client_id, redirectUri: CLAUDE, codeChallenge: CHALLENGE, scope: 'mcp', ...ADMIN, now: 0 });
    const args = { clientId: reg.body.client_id, redirectUri: CLAUDE, codeVerifier: VERIFIER };
    expect((await exchangeCode(db, { ...args, code: await mk(), now: 61_000 })).body.error).toBe('invalid_grant');
    expect((await exchangeCode(db, { ...args, code: await mk(), codeVerifier: 'x'.repeat(43), now: 1 })).body.error).toBe('invalid_grant');
    expect((await exchangeCode(db, { ...args, code: await mk(), redirectUri: 'http://localhost/cb', now: 1 })).body.error).toBe('invalid_grant');
  });

  it('access token vencido o con ADMIN_EMAIL cambiado → null', async () => {
    const { db } = createFakeDb();
    const { ex } = await fullFlow(db);
    expect(await verifyAccessToken(db, ex.body.access_token, { now: 1_001_000 + 3600_000 + 1 })).toBeNull();
    process.env.ADMIN_EMAIL = 'otro@example.com';
    expect(await verifyAccessToken(db, ex.body.access_token, { now: 1_002_000 })).toBeNull();
    expect(await verifyAccessToken(db, 'basura', { now: 1_002_000 })).toBeNull();
  });

  it('refresh rota; reusar el viejo revoca toda la familia', async () => {
    const { db } = createFakeDb();
    const { clientId, ex } = await fullFlow(db);
    const r1 = await refreshTokens(db, { refreshToken: ex.body.refresh_token, clientId, now: 1_010_000 });
    expect(r1.status).toBe(200);
    expect(r1.body.refresh_token).not.toBe(ex.body.refresh_token);
    expect(await verifyAccessToken(db, r1.body.access_token, { now: 1_011_000 })).not.toBeNull();

    const reuse = await refreshTokens(db, { refreshToken: ex.body.refresh_token, clientId, now: 1_012_000 });
    expect(reuse).toMatchObject({ status: 400, body: { error: 'invalid_grant' } });
    expect(await verifyAccessToken(db, r1.body.access_token, { now: 1_013_000 })).toBeNull();
    expect((await refreshTokens(db, { refreshToken: r1.body.refresh_token, clientId, now: 1_014_000 })).body.error).toBe('invalid_grant');
  });

  it('refresh de otro cliente → invalid_grant', async () => {
    const { db } = createFakeDb();
    const { ex } = await fullFlow(db);
    expect((await refreshTokens(db, { refreshToken: ex.body.refresh_token, clientId: 'otro', now: 1_010_000 })).body.error).toBe('invalid_grant');
  });

  it('en Firestore no quedan tokens ni códigos en claro', async () => {
    const { db, docs } = createFakeDb();
    const { code, ex } = await fullFlow(db);
    const dump = JSON.stringify(docs) + Object.keys(docs).join();
    for (const secret of [code, ex.body.access_token, ex.body.refresh_token]) expect(dump).not.toContain(secret);
    const h = createHash('sha256').update(ex.body.access_token).digest('hex');
    expect(Object.keys(docs).some(k => k.endsWith(h))).toBe(true);
  });
});
