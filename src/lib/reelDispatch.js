// Pide un reel ya (dispara el workflow de GitHub Actions .github/workflows/reel-bot.yml) para una pieza
// del bot de contenido. Necesita GITHUB_DISPATCH_TOKEN en Vercel: un fine-grained PAT de este repo con
// "Actions: Read and write" (el mismo tipo que usa cron-job.org). Sin token no falla: la pieza queda
// marcada con `reelPedido` y la toma la próxima corrida programada del reel (lun/mié/vie 10:00).
const REPO = process.env.GITHUB_REPO || 'maliandri/marianoaliandri-portfolio-next';

export async function dispararReel(contenidoId, { fetchImpl = fetch } = {}) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { ok: false, motivo: 'sin_token' };
  try {
    const r = await fetchImpl(`https://api.github.com/repos/${REPO}/actions/workflows/reel-bot.yml/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: JSON.stringify({ ref: 'main', inputs: { tipo: 'explicador', contenido_id: contenidoId } }),
      signal: AbortSignal.timeout(15000),
    });
    if (r.status !== 204) return { ok: false, motivo: `GitHub respondió ${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: e.message };
  }
}

export const textoReel = (r) => (r?.ok
  ? 'El reel se está armando (unos 5 minutos)'
  : r?.motivo === 'sin_token'
    ? 'El reel sale en la próxima corrida automática (lun/mié/vie 10:00)'
    : `El reel queda para la próxima corrida automática (no se pudo pedir ya: ${r?.motivo})`);
