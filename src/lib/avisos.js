// Avisos del sitio a Telegram (2026-11-27): todo lo que pasa en el admin y conviene saber al momento
// (plata que entra, formularios, alguien que abre su auditoría o su presupuesto, cosas para revisar) le llega
// a Mariano con un botón que abre esa pantalla del admin (/admin/?tab=&sub=). Los botones de acción
// ({ texto, data }) los atiende /api/telegram-webhook/.
// - Nunca tira: un aviso que falla no puede romper el webhook o la ruta que lo llama.
// - `avisarUnaVez` no repite el mismo aviso (MercadoPago, Gumroad y Resend reintentan sus webhooks).
// - `ref` guarda a qué cosa corresponde el mensaje (telegram_mensajes/{messageId}), así responder a ese
//   mensaje en Telegram le contesta al cliente del chat en vivo.
import { sendTelegram } from '@/lib/telegram';
import { getDb } from '@/lib/firebase-admin';

export const SITE = 'https://marianoaliandri.com.ar';
export const MENSAJES = 'telegram_mensajes';
export const ENVIADOS = 'avisos_enviados';
const TTL_MS = 60 * 86400000;

export function adminUrl(tab, sub) {
  const q = new URLSearchParams();
  if (tab && tab !== 'inicio') q.set('tab', tab);
  if (sub) q.set('sub', sub);
  return `${SITE}/admin/${q.toString() ? `?${q}` : ''}`;
}

const docId = (s) => String(s).replace(/[^\w.-]+/g, '_').slice(0, 140) || 'sin_clave';
export const pesos = (n) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;

// Botón "Escribirle por WhatsApp" con el teléfono que dejó alguien (celular argentino sin código → +54 9).
export function botonWhatsapp(tel) {
  let d = String(tel || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length < 8) return null;
  if (d.length === 10) d = `549${d}`;
  else if (d.startsWith('54') && !d.startsWith('549') && d.length === 12) d = `549${d.slice(2)}`;
  return { texto: '💬 WhatsApp', url: `https://wa.me/${d}` };
}

export async function recordarMensaje(db, messageId, ref, { now = Date.now() } = {}) {
  if (!db || !messageId || !ref) return;
  await db.collection(MENSAJES).doc(String(messageId)).set({ ...ref, creadoMs: now, expiraEn: new Date(now + TTL_MS) }).catch(() => {});
}

export async function buscarMensaje(db, messageId) {
  if (!db || !messageId) return null;
  const snap = await db.collection(MENSAJES).doc(String(messageId)).get().catch(() => null);
  return snap?.exists ? snap.data() : null;
}

// texto + (opcional) botón a una pantalla del admin (`tab`/`sub`) o a un `url`, más botones/filas extra.
export async function avisar({ texto, tab = null, sub = null, url = null, boton = null, botones = [], filas = null, silencioso = false, ref = null, db = null, send = sendTelegram } = {}) {
  try {
    const abrir = tab || url ? [{ texto: boton || (tab ? '🔎 Abrir en el admin' : 'Abrir'), url: url || adminUrl(tab, sub) }] : [];
    const rows = [...(filas || (botones.length ? [botones] : [])), ...(abrir.length ? [abrir] : [])];
    const r = await send({ texto, filas: rows, silencioso });
    if (r?.ok && ref) await recordarMensaje(db ?? getDb(), r.messageId, ref);
    return r;
  } catch (e) {
    console.error('[avisos] no se pudo avisar:', e?.message);
    return { ok: false, error: 'error' };
  }
}

// Igual que avisar, pero una sola vez por `clave` (si ya salió, no hace nada).
export async function avisarUnaVez(clave, opts = {}, { db = null, now = Date.now() } = {}) {
  try {
    const base = db ?? getDb();
    if (base) {
      try {
        await base.collection(ENVIADOS).doc(docId(clave)).create({ clave: String(clave).slice(0, 300), creadoMs: now, expiraEn: new Date(now + TTL_MS) });
      } catch {
        return { ok: false, error: 'repetido' };
      }
    }
    return await avisar({ ...opts, db: base });
  } catch (e) {
    console.error('[avisos] avisarUnaVez:', e?.message);
    return { ok: false, error: 'error' };
  }
}
