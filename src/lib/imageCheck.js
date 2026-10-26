// Make responde 200 antes de correr el escenario: una imagen rota pasaría como 'ok'.
// Verifica con un GET que la URL (captura Microlink del informe) responda 2xx con content-type
// image/*. Microlink la renderiza en el primer pedido (puede tardar) y la cachea: esto además la "calienta".
// Lo usan la auditoría automática y el servidor MCP.
export async function imageIsReachable(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    const type = res.headers?.get?.('content-type') || '';
    res.body?.cancel?.();
    if (res.ok && type.startsWith('image/')) return { ok: true, detail: '' };
    return { ok: false, detail: res.ok ? `content-type ${type || 'vacío'}` : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detail: e.message };
  }
}
