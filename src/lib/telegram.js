// Avisos a Mariano por Telegram (venta por consulta, 2026-11-25). Bot creado con @BotFather.
// Env: TELEGRAM_BOT_TOKEN (el token del bot) y TELEGRAM_CHAT_ID (el chat de Mariano con el bot).
// Nunca tira: un aviso que falla no puede romper la tienda.
//
// Botones (2026-11-27): cada botón es { texto, url } (abre un link) o { texto, data } (lo recibe
// /api/telegram-webhook/ como callback_query; `data` ≤ 64 bytes). `botones` = una fila; `filas` = varias.

function teclado(botones = [], filas = null) {
  const rows = (filas || (botones.length ? [botones] : []))
    .map(f => f.filter(Boolean).map(b => (b.data ? { text: b.texto, callback_data: String(b.data).slice(0, 64) } : { text: b.texto, url: b.url })))
    .filter(f => f.length);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

// Llamada cruda a la API de bots. Devuelve { ok, result } o { ok:false, error }. Nunca tira.
export async function telegramApi(method, body, { env = process.env, fetchImpl = fetch } = {}) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'sin config' };
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    return d.ok ? { ok: true, result: d.result } : { ok: false, error: d.description || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, error: String(e?.message || e).slice(0, 200) };
  }
}

export async function sendTelegram({ texto, botones = [], filas = null, silencioso = false, responderA = null, env = process.env, fetchImpl = fetch } = {}) {
  const chat = env.TELEGRAM_CHAT_ID;
  if (!env.TELEGRAM_BOT_TOKEN || !chat) return { ok: false, error: 'sin config' };
  const body = { chat_id: chat, text: String(texto).slice(0, 4000), disable_web_page_preview: true };
  const markup = teclado(botones, filas);
  if (markup) body.reply_markup = markup;
  if (silencioso) body.disable_notification = true;
  if (responderA) body.reply_parameters = { message_id: responderA, allow_sending_without_reply: true };
  const r = await telegramApi('sendMessage', body, { env, fetchImpl });
  return r.ok ? { ok: true, messageId: r.result?.message_id } : r;
}

// Cambia el texto (y los botones) de un mensaje ya enviado. Sin `botones`/`filas` los saca.
export function editTelegram({ messageId, texto, botones = [], filas = null, env = process.env, fetchImpl = fetch }) {
  const body = { chat_id: env.TELEGRAM_CHAT_ID, message_id: messageId, text: String(texto).slice(0, 4000), disable_web_page_preview: true };
  body.reply_markup = teclado(botones, filas) || { inline_keyboard: [] };
  return telegramApi('editMessageText', body, { env, fetchImpl });
}

// Cartelito arriba en Telegram al tocar un botón (hay que contestarlo siempre, si no queda el relojito).
export function answerCallback(id, texto = '', { env = process.env, fetchImpl = fetch } = {}) {
  return telegramApi('answerCallbackQuery', { callback_query_id: id, text: String(texto).slice(0, 190) }, { env, fetchImpl });
}
