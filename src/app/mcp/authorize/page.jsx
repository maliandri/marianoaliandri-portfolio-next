import { getDb } from '@/lib/firebase-admin';
import { mcpEnabled } from '@/lib/mcp/config';
import { validateAuthorizeRequest } from '@/lib/mcp/oauth';
import AuthorizeClient from './AuthorizeClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Conectar Claude', robots: { index: false, follow: false } };

const PARAMS = ['client_id', 'redirect_uri', 'response_type', 'state', 'code_challenge', 'code_challenge_method', 'scope', 'resource'];

// Pantalla de consentimiento del OAuth del servidor MCP (authorization_endpoint). Se valida el
// pedido acá: si el cliente o el redirect no son válidos, NO se redirige a ningún lado.
export default async function AuthorizePage({ searchParams }) {
  const sp = await searchParams;
  const params = Object.fromEntries(PARAMS.filter(k => typeof sp?.[k] === 'string').map(k => [k, sp[k]]));

  let error = null;
  let client = null;
  if (!mcpEnabled()) error = 'El conector está deshabilitado.';
  else {
    const db = getDb();
    const v = db ? await validateAuthorizeRequest(db, params) : { ok: false, error: 'server_error' };
    if (v.ok) client = v.client;
    else error = `Pedido de autorización inválido (${v.error}).`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      {error ? (
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-3">No se puede conectar</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      ) : (
        <AuthorizeClient
          params={params}
          clientName={client.clientName || 'Claude'}
          redirectHost={new URL(params.redirect_uri).host}
          loopback={new URL(params.redirect_uri).protocol === 'http:'}
        />
      )}
    </div>
  );
}
