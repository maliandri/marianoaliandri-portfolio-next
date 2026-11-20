// Datos públicos de otras cuentas de Instagram por la API oficial (business_discovery).
// Solo responde para cuentas profesionales (Business/Creator): las personales vuelven como "no disponible".
// Lógica pura con fetch inyectable, sin I/O propio.
const GRAPH_URL = 'https://graph.facebook.com/v23.0';

// Usuarios válidos de Instagram: letras, números, punto y guion bajo. Se valida antes de armar el campo
// de la consulta para que un valor raro no pueda meter otros campos en la expresión.
export const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

const LIMITES = new Set([4, 17, 32, 613, 80002]); // límites de uso de Meta
const NO_PROFESIONAL = new Set([110, 24, 100]); // cuenta personal, inexistente o privada

export class DiscoveryLimitError extends Error {}
export class DiscoveryTokenError extends Error {}

export async function discoverAccount({ creds, handle, fetchImpl = fetch }) {
  const h = String(handle || '').trim().replace(/^@/, '').toLowerCase();
  if (!HANDLE_RE.test(h)) return { handle: h, ok: false, motivo: 'usuario inválido' };

  const campos = 'username,name,biography,website,followers_count,media_count';
  const qs = new URLSearchParams({ fields: `business_discovery.username(${h}){${campos}}`, access_token: creds.accessToken });
  let data = {};
  try {
    const resp = await fetchImpl(`${GRAPH_URL}/${creds.igUserId}?${qs}`, { signal: AbortSignal.timeout(20000) });
    data = await resp.json().catch(() => ({}));
  } catch {
    return { handle: h, ok: false, motivo: 'sin respuesta' };
  }

  if (data.error) {
    const code = data.error.code;
    if (LIMITES.has(code)) throw new DiscoveryLimitError(`Meta pidió pausar por límite de uso (código ${code}).`);
    if (code === 190) throw new DiscoveryTokenError('El token de Instagram venció o es inválido.');
    return { handle: h, ok: false, motivo: NO_PROFESIONAL.has(code) ? 'personal o no disponible' : `error ${code}` };
  }

  const d = data.business_discovery || {};
  return {
    handle: h, ok: true,
    nombre: d.name || '', bio: d.biography || '', web: d.website || '',
    seguidores: d.followers_count ?? null, posts: d.media_count ?? null,
  };
}
