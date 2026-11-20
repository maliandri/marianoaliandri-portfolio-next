export const dynamic = 'force-dynamic';

// Datos públicos de las cuentas que seguís (admin). POST { handles: [...] } (máx. 5 por llamada) →
// { items: [{ handle, ok, nombre, bio, web, seguidores, posts } | { handle, ok: false, motivo }], pausa? }
// Usa business_discovery con el token de la app (IG_ACCESS_TOKEN). Lógica en src/lib/igDiscovery.js.
// Nada se guarda en el servidor: el navegador guarda lo que recibe.
import { requireAdmin } from '@/lib/adminAuth';
import { igCredsFromEnv } from '../../../../scripts/igStoryClient.mjs';
import { discoverAccount, DiscoveryLimitError, DiscoveryTokenError } from '@/lib/igDiscovery';

export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;

  const creds = igCredsFromEnv();
  if (!creds) return Response.json({ error: 'IG_ACCESS_TOKEN o IG_USER_ID no están configurados.' }, { status: 500 });

  const { handles } = await request.json().catch(() => ({}));
  const lista = Array.isArray(handles) ? handles.slice(0, 5) : [];
  if (!lista.length) return Response.json({ error: 'Falta handles.' }, { status: 400 });

  const items = [];
  for (const handle of lista) {
    try {
      items.push(await discoverAccount({ creds, handle }));
    } catch (e) {
      if (e instanceof DiscoveryLimitError) return Response.json({ items, pausa: true, error: e.message });
      if (e instanceof DiscoveryTokenError) return Response.json({ items, error: e.message }, { status: 502 });
      return Response.json({ items, error: 'Error interno' }, { status: 500 });
    }
  }
  return Response.json({ items });
}
