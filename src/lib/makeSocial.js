// Webhook del Router principal de Make (publicador de redes). Lo usan /api/publish-social, la
// auditoría automática y el servidor MCP. La URL nunca se devuelve en una respuesta.
const MAKE_WEBHOOK_DEFAULT = 'https://hook.us2.make.com/574hhr7jtxm2rsn52ntkghpxohcdhjvi';

export function makeSocialWebhookUrl() {
  return process.env.MAKE_SOCIAL_WEBHOOK_URL || MAKE_WEBHOOK_DEFAULT;
}

// Lanza si Make no responde 2xx. Make responde 200 antes de correr el escenario: un 200 solo
// significa que aceptó el payload.
export async function postToMakeSocial(payload, { timeoutMs } = {}) {
  const response = await fetch(makeSocialWebhookUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    ...(timeoutMs ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
  });
  if (!response.ok) {
    throw Object.assign(new Error(`Make.com webhook failed: ${response.status}`), { status: response.status });
  }
}
