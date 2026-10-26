// Respuestas comunes de los endpoints OAuth/MCP.

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, mcp-protocol-version',
};

export const json = (body, status = 200, headers = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...CORS, ...headers } });

export const disabled = () => json({ error: 'temporarily_unavailable', error_description: 'MCP deshabilitado' }, 503);

export const tooMany = (retryAfterS) =>
  json({ error: 'slow_down', error_description: `Demasiados pedidos, reintentá en ${retryAfterS} s` }, 429, { 'Retry-After': String(retryAfterS) });

export const preflight = () => new Response(null, { status: 204, headers: CORS });

// IP del cliente detrás del proxy de Vercel (solo para rate limiting).
export function clientIp(req) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
