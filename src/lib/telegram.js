// Avisos a Mariano por Telegram (venta por consulta, 2026-11-25). Bot creado con @BotFather.
// Env: TELEGRAM_BOT_TOKEN (el token del bot) y TELEGRAM_CHAT_ID (el chat de Mariano con el bot).
// Nunca tira: un aviso que falla no puede romper la tienda.

export async function sendTelegram({ texto, botones = [], env = process.env, fetchImpl = fetch } = {}) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chat = env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { ok: false, error: 'sin config' };
  try {
    const body = { chat_id: chat, text: String(texto).slice(0, 4000), disable_web_page_preview: true };
    if (botones.length) body.reply_markup = { inline_keyboard: [botones.map(b => ({ text: b.texto, url: b.url }))] };
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    return d.ok ? { ok: true, messageId: d.result?.message_id } : { ok: false, error: d.description || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}
