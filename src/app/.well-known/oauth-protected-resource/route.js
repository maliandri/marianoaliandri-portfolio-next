import { generateProtectedResourceMetadata } from 'mcp-handler';
import { issuer, mcpEnabled, mcpUrl } from '@/lib/mcp/config';
import { json, disabled, preflight } from '@/lib/mcp/http';

export const dynamic = 'force-dynamic';

// Protected Resource Metadata (RFC 9728). `resource` tiene que ser exactamente la URL que se
// carga en Claude (con barra final) y `authorization_servers` un solo issuer (Claude usa el primero).
export function GET() {
  if (!mcpEnabled()) return disabled();
  return json(generateProtectedResourceMetadata({
    authServerUrls: [issuer()],
    resourceUrl: mcpUrl(),
    additionalMetadata: { scopes_supported: ['mcp'] },
  }));
}

export const OPTIONS = preflight;
