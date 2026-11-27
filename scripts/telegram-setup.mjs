// Registra el webhook del bot de Telegram (una sola vez, o si cambia la clave). Ver src/app/api/telegram-webhook/.
// Uso: node --env-file=.env.local scripts/telegram-setup.mjs
// Necesita TELEGRAM_BOT_TOKEN y TELEGRAM_WEBHOOK_SECRET (la misma clave que en Vercel). La URL va CON barra final:
// sin ella, trailingSlash:true responde 308 y Telegram no reenvía el POST.
const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
if (!token || !secret) {
  console.error('Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_WEBHOOK_SECRET');
  process.exit(1);
}
const url = process.env.TELEGRAM_WEBHOOK_URL || 'https://marianoaliandri.com.ar/api/telegram-webhook/';
const api = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  });
  return r.json();
};

const set = await api('setWebhook', { url, secret_token: secret, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
console.log('setWebhook:', set.ok ? 'ok' : set.description);
const info = await api('getWebhookInfo');
const { url: u, pending_update_count, last_error_message } = info.result || {};
console.log('webhook:', { url: u, pendientes: pending_update_count, ultimoError: last_error_message || null });
