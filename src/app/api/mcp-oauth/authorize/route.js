export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { getUserFromRequest } from '@/lib/authServer';
import { isAdminEmail, mcpEnabled } from '@/lib/mcp/config';
import { validateAuthorizeRequest, createAuthCode } from '@/lib/mcp/oauth';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { json, disabled, tooMany, clientIp } from '@/lib/mcp/http';

// La llama la página /mcp/authorize/ cuando Mariano aprueba: Authorization: Bearer <idToken de
// Firebase> + { params } (los de la URL de /authorize). Solo la cuenta ADMIN_EMAIL obtiene código.
export async function POST(request) {
  if (!mcpEnabled()) return disabled();
  const db = getDb();
  if (!db) return json({ error: 'server_error' }, 500);

  const limit = await hitRateLimit(db, `authorize:${clientIp(request)}`, { limit: 20, windowS: 60 });
  if (!limit.ok) return tooMany(limit.retryAfterS);

  const user = await getUserFromRequest(request);
  if (!user) return json({ error: 'login_required' }, 401);
  if (!user.emailVerified || !isAdminEmail(user.email)) return json({ error: 'access_denied' }, 403);

  const { params } = await request.json().catch(() => ({}));
  const v = await validateAuthorizeRequest(db, params || {});
  if (!v.ok) return json({ error: v.error }, 400);

  const code = await createAuthCode(db, {
    clientId: params.client_id, redirectUri: params.redirect_uri, codeChallenge: params.code_challenge,
    scope: 'mcp', resource: params.resource || null, uid: user.uid, email: user.email,
  });
  const to = new URL(params.redirect_uri);
  to.searchParams.set('code', code);
  if (params.state) to.searchParams.set('state', params.state);
  return json({ redirectTo: to.toString() });
}
