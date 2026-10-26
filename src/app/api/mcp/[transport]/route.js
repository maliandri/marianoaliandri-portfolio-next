import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { getDb } from '@/lib/firebase-admin';
import { baseUrl, mcpEnabled } from '@/lib/mcp/config';
import { verifyAccessToken } from '@/lib/mcp/oauth';
import { registerTools } from '@/lib/mcp/defineTool';
import { ALL_TOOLS } from '@/lib/mcp/register';
import { disabled } from '@/lib/mcp/http';

// Servidor MCP remoto (Streamable HTTP) para el conector personalizado de Claude.
// URL: https://marianoaliandri.com.ar/api/mcp/mcp/ (con barra final: trailingSlash: true).
// Auth: OAuth propio (src/lib/mcp/oauth.js); solo la cuenta ADMIN_EMAIL obtiene tokens.
export const dynamic = 'force-dynamic';
// search_leads sigue trabajando en segundo plano (after) dentro de este tope. Pro + Fluid: 800 s.
export const maxDuration = 800;

const handler = createMcpHandler(
  (server) => registerTools(server, ALL_TOOLS, { getDb }),
  { serverInfo: { name: 'marianoaliandri', version: '1.0.0' } },
);

async function verify(_req, bearerToken) {
  if (!bearerToken) return undefined;
  const db = getDb();
  if (!db) return undefined;
  const t = await verifyAccessToken(db, bearerToken);
  if (!t) return undefined;
  return {
    token: bearerToken,
    clientId: t.clientId,
    scopes: ['mcp'],
    expiresAt: Math.floor(t.expiresAt / 1000),
    extra: { uid: t.uid, email: t.email },
  };
}

async function route(req) {
  if (!mcpEnabled()) return disabled();
  const authed = withMcpAuth(handler, verify, {
    required: true,
    resourceUrl: baseUrl(),
    resourceMetadataPath: '/.well-known/oauth-protected-resource/',
  });
  return authed(req);
}

export { route as GET, route as POST, route as DELETE };
