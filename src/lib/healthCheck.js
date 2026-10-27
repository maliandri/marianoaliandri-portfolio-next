// Chequeo diario de credenciales que vencen o se revocan sin avisar (lo corre el cron de Vercel,
// /api/cron/health/). Cada problema → alerta por mail (src/lib/alert.js). Pasó el 2026-10-26: el token
// de Instagram cargado en Vercel era de corta duración y las historias dejaron de salir sin aviso.
const GRAPH = 'https://graph.facebook.com/v23.0';
export const WARN_DAYS = 7;
const DAY = 86400000;

// Vencimientos de Meta: expires_at (0 = no vence) y data_access_expires_at (se renueva cada 90 días).
export function tokenExpiryProblems(debug, now = Date.now()) {
  const out = [];
  for (const [field, label] of [['expires_at', 'El token'], ['data_access_expires_at', 'El acceso a datos del token']]) {
    const ts = Number(debug?.[field] || 0) * 1000;
    if (!ts) continue;
    const days = Math.floor((ts - now) / DAY);
    if (days <= WARN_DAYS) {
      out.push(`${label} ${days < 0 ? 'venció' : `vence en ${days} día${days === 1 ? '' : 's'}`} (${new Date(ts).toISOString().slice(0, 10)}).`);
    }
  }
  return out;
}

export async function checkInstagram({ env = process.env, fetchImpl = fetch, now = Date.now() } = {}) {
  const token = env.IG_ACCESS_TOKEN;
  const igId = env.IG_USER_ID;
  if (!token || !igId) return { ok: false, problems: ['IG_ACCESS_TOKEN o IG_USER_ID no están configurados: no salen historias.'] };

  const who = await fetchImpl(`${GRAPH}/${igId}?fields=username&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) })
    .then(r => r.json()).catch(e => ({ error: { message: e.message } }));
  if (who.error || !who.username) {
    return { ok: false, problems: [`El token de Instagram no sirve: ${who.error?.message || 'sin respuesta'}. Generar uno nuevo (ver memoria "Historias con Make").`] };
  }

  // El token se inspecciona a sí mismo. Si Meta no lo permite, el token igual sirve: no es alerta.
  const dbg = await fetchImpl(`${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) })
    .then(r => r.json()).catch(() => ({}));
  const problems = dbg.data ? tokenExpiryProblems(dbg.data, now) : [];
  if (dbg.data && dbg.data.is_valid === false) problems.unshift('Meta marca el token como inválido.');
  return { ok: problems.length === 0, problems, username: who.username, debug: dbg.data ? { expires_at: dbg.data.expires_at, data_access_expires_at: dbg.data.data_access_expires_at } : null };
}

export async function checkMercadoPago({ env = process.env, fetchImpl = fetch } = {}) {
  if (!env.MERCADOPAGO_ACCESS_TOKEN) return { ok: false, problems: ['MERCADOPAGO_ACCESS_TOKEN no está configurado: no se puede cobrar.'] };
  const r = await fetchImpl('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN.trim()}` }, signal: AbortSignal.timeout(15000),
  }).catch(e => ({ ok: false, status: e.message }));
  return r.ok ? { ok: true, problems: [] } : { ok: false, problems: [`El token de MercadoPago no sirve (respuesta ${r.status}): no se puede cobrar.`] };
}
