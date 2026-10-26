// Configuración del servidor MCP y de lo que comparte con el resto del sitio (URL base, topes).

export function baseUrl() {
  return (process.env.MCP_BASE_URL || 'https://marianoaliandri.com.ar').replace(/\/+$/, '');
}

// Entero positivo de una env var, o el default si falta o es inválido.
export function envInt(name, def) {
  const n = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}
