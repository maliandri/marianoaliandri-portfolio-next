import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { isAdminEmail, mcpUrl } from './config';

// Authorization server OAuth 2.1 mínimo para el conector de Claude: DCR (RFC 7591), código con
// PKCE S256 y refresh tokens rotativos. Solo se guarda el sha256 de códigos y tokens.
// Ver docs/superpowers/specs/2026-10-26-mcp-server-design.md, sección 4.

const CLIENTS = 'mcp_oauth_clients';
const CODES = 'mcp_oauth_codes';
const TOKENS = 'mcp_oauth_tokens';

export const ACCESS_TTL_S = 3600;
export const REFRESH_TTL_S = 30 * 24 * 3600;
export const CODE_TTL_S = 60;
export const REUSE_GRACE_MS = 30_000;

const CLAUDE_CALLBACKS = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.com/api/mcp/auth_callback'];
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1'];

const sha256 = (s) => createHash('sha256').update(String(s)).digest('hex');
const newSecret = () => randomBytes(32).toString('base64url');
const grantError = (error = 'invalid_grant', description) =>
  ({ status: 400, body: { error, ...(description ? { error_description: description } : {}) } });

function parseUrl(uri) {
  try { return new URL(uri); } catch { return null; }
}

const isLoopback = (u) => u && u.protocol === 'http:' && LOOPBACK_HOSTS.includes(u.hostname);

// Callbacks de las apps de Claude, o loopback en cualquier puerto (Claude Code, MCP Inspector).
export function isAllowedRedirect(uri) {
  if (CLAUDE_CALLBACKS.includes(uri)) return true;
  return isLoopback(parseUrl(uri));
}

// RFC 8252: un redirect loopback se compara sin el puerto (Claude Code usa uno efímero).
function redirectMatches(registered, requested) {
  if (registered === requested) return true;
  const a = parseUrl(registered), b = parseUrl(requested);
  return isLoopback(a) && isLoopback(b) && a.hostname === b.hostname && a.pathname === b.pathname && a.search === b.search;
}

export function verifyPkceS256(verifier, challenge) {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const a = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
  const b = Buffer.from(String(challenge || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

const sameResource = (r) => String(r).replace(/\/+$/, '') === mcpUrl().replace(/\/+$/, '');

export async function registerClient(db, body) {
  const uris = Array.isArray(body?.redirect_uris) ? body.redirect_uris : [];
  if (!uris.length || uris.length > 5 || !uris.every(u => typeof u === 'string' && u.length <= 500 && isAllowedRedirect(u))) {
    return { status: 400, body: { error: 'invalid_redirect_uri', error_description: 'redirect_uris no permitidas' } };
  }
  const clientName = typeof body.client_name === 'string' ? body.client_name.slice(0, 100) : null;
  const clientId = randomBytes(18).toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  await db.collection(CLIENTS).doc(clientId).set({ redirectUris: uris, clientName, createdAt: FieldValue.serverTimestamp() });
  return {
    status: 201,
    body: {
      client_id: clientId,
      client_id_issued_at: issuedAt,
      client_name: clientName,
      redirect_uris: uris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
  };
}

export async function getClient(db, clientId) {
  if (typeof clientId !== 'string' || !/^[\w-]{10,64}$/.test(clientId)) return null;
  const snap = await db.collection(CLIENTS).doc(clientId).get();
  return snap.exists ? { clientId, ...snap.data() } : null;
}

// Valida los parámetros de /authorize. No emite nada.
export async function validateAuthorizeRequest(db, p) {
  const client = await getClient(db, p?.client_id);
  if (!client) return { ok: false, error: 'invalid_client' };
  if (!client.redirectUris.some(r => redirectMatches(r, p.redirect_uri))) return { ok: false, error: 'invalid_redirect_uri' };
  if (p.response_type !== 'code') return { ok: false, error: 'unsupported_response_type' };
  if (p.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(p.code_challenge || '')) {
    return { ok: false, error: 'invalid_request', description: 'PKCE S256 obligatorio' };
  }
  if (p.resource && !sameResource(p.resource)) return { ok: false, error: 'invalid_target' };
  return { ok: true, client };
}

export async function createAuthCode(db, { clientId, redirectUri, codeChallenge, scope, resource, uid, email, now = Date.now() }) {
  const code = newSecret();
  await db.collection(CODES).doc(sha256(code)).set({
    clientId, redirectUri, codeChallenge, scope: scope || 'mcp', resource: resource || null, uid, email,
    expiresAt: now + CODE_TTL_S * 1000,
  });
  return code;
}

async function issueTokens(db, { clientId, uid, email, scope, familyId, now }) {
  const access = newSecret();
  const refresh = newSecret();
  const base = { clientId, uid, email, scope, familyId, createdAt: now };
  await db.collection(TOKENS).doc(sha256(access)).set({ ...base, type: 'access', expiresAt: now + ACCESS_TTL_S * 1000 });
  await db.collection(TOKENS).doc(sha256(refresh)).set({ ...base, type: 'refresh', used: false, expiresAt: now + REFRESH_TTL_S * 1000 });
  return {
    status: 200,
    body: { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_S, refresh_token: refresh, scope },
  };
}

async function revokeFamily(db, familyId) {
  const snap = await db.collection(TOKENS).where('familyId', '==', familyId).get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
}

export async function exchangeCode(db, { code, clientId, redirectUri, codeVerifier, now = Date.now() }) {
  if (typeof code !== 'string' || !code) return grantError('invalid_request', 'code requerido');
  const ref = db.collection(CODES).doc(sha256(code));
  // Un solo uso: se lee y se borra en la misma transacción.
  const data = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    tx.delete(ref);
    return snap.data();
  });
  if (!data || data.expiresAt < now) return grantError();
  if (data.clientId !== clientId || data.redirectUri !== redirectUri) return grantError();
  if (!verifyPkceS256(codeVerifier, data.codeChallenge)) return grantError();
  if (!isAdminEmail(data.email)) return grantError();
  return issueTokens(db, { clientId, uid: data.uid, email: data.email, scope: data.scope, familyId: newSecret(), now });
}

export async function refreshTokens(db, { refreshToken, clientId, now = Date.now() }) {
  if (typeof refreshToken !== 'string' || !refreshToken) return grantError('invalid_request', 'refresh_token requerido');
  const ref = db.collection(TOKENS).doc(sha256(refreshToken));
  const result = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { bad: true };
    const t = snap.data();
    if (t.type !== 'refresh' || t.clientId !== clientId) return { bad: true };
    // Margen de reintento: si la respuesta del refresh anterior se perdió (timeout), Claude vuelve a
    // mandar el mismo refresh enseguida. Dentro de REUSE_GRACE_MS se rota de nuevo sin revocar.
    if (t.used && now - (t.usedAt || 0) > REUSE_GRACE_MS) return { reuse: true, familyId: t.familyId };
    if (t.expiresAt < now) return { bad: true };
    if (!t.used) tx.update(ref, { used: true, usedAt: now });
    return { ok: true, t };
  });
  if (result.reuse) {
    // Un refresh ya rotado que vuelve a aparecer = posible robo: se corta toda la familia.
    await revokeFamily(db, result.familyId);
    return grantError();
  }
  if (!result.ok || !isAdminEmail(result.t.email)) return grantError();
  const { uid, email, scope, familyId } = result.t;
  return issueTokens(db, { clientId, uid, email, scope, familyId, now });
}

export async function verifyAccessToken(db, token, { now = Date.now() } = {}) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const snap = await db.collection(TOKENS).doc(sha256(token)).get();
  if (!snap.exists) return null;
  const t = snap.data();
  if (t.type !== 'access' || t.expiresAt < now || !isAdminEmail(t.email)) return null;
  return { uid: t.uid, email: t.email, clientId: t.clientId, scope: t.scope, expiresAt: t.expiresAt };
}
