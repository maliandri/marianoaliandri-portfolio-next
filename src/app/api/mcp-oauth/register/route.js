export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { mcpEnabled } from '@/lib/mcp/config';
import { registerClient } from '@/lib/mcp/oauth';
import { hitRateLimit } from '@/lib/mcp/rateLimit';
import { json, disabled, tooMany, preflight, clientIp } from '@/lib/mcp/http';

// Dynamic Client Registration (RFC 7591, JSON). Es público por diseño: registrarse no da acceso
// a nada (el login exige ADMIN_EMAIL). Solo se aceptan los callbacks de Claude y loopback.
export async function POST(request) {
  if (!mcpEnabled()) return disabled();
  const db = getDb();
  if (!db) return json({ error: 'server_error' }, 500);

  const limit = await hitRateLimit(db, `register:${clientIp(request)}`, { limit: 20, windowS: 86400 });
  if (!limit.ok) return tooMany(limit.retryAfterS);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'invalid_client_metadata' }, 400);
  const r = await registerClient(db, body);
  return json(r.body, r.status);
}

export const OPTIONS = preflight;
