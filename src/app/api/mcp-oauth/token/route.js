export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { mcpEnabled } from '@/lib/mcp/config';
import { exchangeCode, refreshTokens } from '@/lib/mcp/oauth';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { json, disabled, tooMany, preflight, clientIp } from '@/lib/mcp/http';

// Token endpoint (RFC 6749): Claude manda application/x-www-form-urlencoded, tanto el canje del
// código como cada refresh. Tiene que responder rápido (Claude espera 10 s / 30 s).
export async function POST(request) {
  if (!mcpEnabled()) return disabled();
  if (!(request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded')) {
    return json({ error: 'invalid_request', error_description: 'Se espera application/x-www-form-urlencoded' }, 400);
  }
  const db = getDb();
  if (!db) return json({ error: 'server_error' }, 500);

  const limit = await hitRateLimit(db, `token:${clientIp(request)}`, { limit: 30, windowS: 60 });
  if (!limit.ok) return tooMany(limit.retryAfterS);

  const p = new URLSearchParams(await request.text());
  const grant = p.get('grant_type');
  let r;
  if (grant === 'authorization_code') {
    r = await exchangeCode(db, {
      code: p.get('code'), clientId: p.get('client_id'), redirectUri: p.get('redirect_uri'), codeVerifier: p.get('code_verifier'),
    });
  } else if (grant === 'refresh_token') {
    r = await refreshTokens(db, { refreshToken: p.get('refresh_token'), clientId: p.get('client_id') });
  } else {
    r = { status: 400, body: { error: 'unsupported_grant_type' } };
  }
  return json(r.body, r.status);
}

export const OPTIONS = preflight;
