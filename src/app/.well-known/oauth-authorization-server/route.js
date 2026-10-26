import { baseUrl, issuer, mcpEnabled } from '@/lib/mcp/config';
import { json, disabled, preflight } from '@/lib/mcp/http';

export const dynamic = 'force-dynamic';

// Authorization Server Metadata (RFC 8414) del OAuth propio del servidor MCP.
// Todas las URLs con barra final (trailingSlash: true en next.config.mjs).
export function GET() {
  if (!mcpEnabled()) return disabled();
  const b = baseUrl();
  return json({
    issuer: issuer(),
    authorization_endpoint: `${b}/mcp/authorize/`,
    token_endpoint: `${b}/api/mcp-oauth/token/`,
    registration_endpoint: `${b}/api/mcp-oauth/register/`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp', 'offline_access'],
  });
}

export const OPTIONS = preflight;
