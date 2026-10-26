// Configuración del servidor MCP y de lo que comparte con el resto del sitio (URL base, topes).
// Todo se lee de las env vars en cada llamada (no al cargar el módulo).

export function baseUrl() {
  return (process.env.MCP_BASE_URL || 'https://marianoaliandri.com.ar').replace(/\/+$/, '');
}

// Con barra final: trailingSlash: true en next.config.mjs redirige (308) un POST sin barra.
export const mcpUrl = () => `${baseUrl()}/api/mcp/mcp/`;
export const resourceMetadataUrl = () => `${baseUrl()}/.well-known/oauth-protected-resource/`;
export const issuer = () => baseUrl();

// Interruptor general: sin MCP_ENABLED=true el endpoint MCP y el OAuth responden 503.
export const mcpEnabled = () => process.env.MCP_ENABLED === 'true';

// Misma regla que requireAdmin(): sin ADMIN_EMAIL no entra nadie.
export function isAdminEmail(email) {
  const admin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return !!admin && String(email || '').trim().toLowerCase() === admin;
}

// Entero positivo de una env var, o el default si falta o es inválido.
export function envInt(name, def) {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}
