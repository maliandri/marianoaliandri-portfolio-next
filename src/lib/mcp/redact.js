// Última red antes de devolverle algo a Claude: tacha cualquier valor de una env var sensible
// (claves, tokens, secretos, webhooks) y las URLs de webhooks de Make, por si un error de un
// tercero o un dato guardado los trae adentro.
const SENSITIVE_NAME = /KEY|SECRET|TOKEN|PASSWORD|PRIVATE|WEBHOOK|CLIENT_EMAIL/i;
const MAKE_HOOK = /https?:\/\/hook\.[a-z0-9]+\.make\.com\/[A-Za-z0-9_-]+/gi;
const MASK = '[oculto]';

function secretValues() {
  const out = [];
  for (const [name, value] of Object.entries(process.env)) {
    if (!SENSITIVE_NAME.test(name) || typeof value !== 'string') continue;
    const v = value.trim();
    if (v.length >= 8) out.push(v);
    // FIREBASE_PRIVATE_KEY viene con \n literales: tachar también la versión con saltos reales.
    if (v.includes('\\n')) out.push(v.replace(/\\n/g, '\n'));
  }
  return out.sort((a, b) => b.length - a.length);
}

function redactString(s, values) {
  let out = s.replace(MAKE_HOOK, MASK);
  for (const v of values) if (out.includes(v)) out = out.split(v).join(MASK);
  return out;
}

export function redactSecrets(value, values = secretValues()) {
  if (typeof value === 'string') return redactString(value, values);
  if (Array.isArray(value)) return value.map(v => redactSecrets(v, values));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactSecrets(v, values)]));
  }
  return value;
}
