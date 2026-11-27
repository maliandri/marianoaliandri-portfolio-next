// Chat en vivo con el cliente (2026-11-26). Las conversaciones del asistente de la tienda y del asesor de la
// auditoría privada se guardan en `chats_vivo/{id}` (+ subcolección `mensajes`). Telegram le manda a Mariano un
// link a /admin/chat/<id>/ donde ve la charla en vivo, toma el control (la IA deja de contestar) y le escribe él.
// El navegador del cliente consulta /api/chat-vivo/ cada pocos segundos para traer lo que escribe Mariano.
// Desde Telegram (2026-11-27): cada aviso de chat queda asociado a la charla (telegram_mensajes); responder ese
// mensaje le contesta al cliente (/api/telegram-webhook/), y con el control tomado los mensajes del cliente llegan ahí.
import { sendTelegram } from '@/lib/telegram';
import { recordarMensaje } from '@/lib/avisos';

export const CHATS = 'chats_vivo';
export const SITE = 'https://marianoaliandri.com.ar';
const ID_RE = /^[a-z]+_[A-Za-z0-9_-]{8,64}$/;
const MAX_TEXTO = 2000;
const TTL_MS = 60 * 86400000;

export const idValido = (id) => ID_RE.test(String(id || ''));
export const linkAdminChat = (id) => `${SITE}/admin/chat/${encodeURIComponent(id)}/`;
const limpiar = (t) => String(t ?? '').trim().slice(0, MAX_TEXTO);

// Guarda un mensaje (cliente | asistente | mariano). Crea el chat si no existía. Devuelve { estado, nuevo }.
// `info` (origen, titulo, contexto) solo se escribe al crear el chat.
export async function registrarMensaje(db, id, { rol, texto }, info = {}, { now = Date.now(), reenviar = reenviarATelegram } = {}) {
  if (!idValido(id)) throw new Error('chat inválido');
  const t = limpiar(texto);
  const ref = db.collection(CHATS).doc(id);
  let nuevo = false;
  let estado = 'ia';
  let titulo = '';
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? snap.data() : null;
    nuevo = !prev;
    estado = prev?.estado || 'ia';
    titulo = prev?.titulo || String(info.titulo || 'Visitante');
    tx.set(ref, {
      ...(prev ? {} : {
        origen: String(info.origen || 'sitio').slice(0, 30),
        titulo: String(info.titulo || 'Visitante').slice(0, 140),
        contexto: info.contexto || {},
        estado: 'ia',
        creadoMs: now,
        expiraEn: new Date(now + TTL_MS),
      }),
      actualizadoMs: now,
      ...(rol === 'cliente' ? { ultimoClienteMs: now, ultimoCliente: t.slice(0, 300) } : {}),
      ...(rol === 'mariano' ? { ultimoMarianoMs: now } : {}),
      mensajes: (prev?.mensajes || 0) + 1,
    }, { merge: true });
  });
  if (t) await ref.collection('mensajes').add({ rol, texto: t, ms: now });
  // Con el control tomado, lo que escribe el cliente le llega a Mariano a Telegram (y lo contesta respondiendo).
  if (rol === 'cliente' && estado === 'humano' && t) await Promise.resolve(reenviar(db, id, { titulo, texto: t })).catch(() => {});
  return { estado, nuevo };
}

export async function leerChat(db, id) {
  if (!idValido(id)) return null;
  const snap = await db.collection(CHATS).doc(id).get();
  return snap.exists ? { id, ...snap.data() } : null;
}

export async function mensajesDesde(db, id, desdeMs = 0, { soloRol = null, limite = 200 } = {}) {
  const snap = await db.collection(CHATS).doc(id).collection('mensajes')
    .where('ms', '>', Number(desdeMs) || 0).orderBy('ms', 'asc').limit(limite).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !soloRol || m.rol === soloRol);
}

export async function cambiarEstado(db, id, estado, { now = Date.now() } = {}) {
  if (!['ia', 'humano'].includes(estado)) throw new Error('estado inválido');
  await db.collection(CHATS).doc(id).set({ estado, actualizadoMs: now }, { merge: true });
}

export async function listarChats(db, { limite = 30 } = {}) {
  const snap = await db.collection(CHATS).orderBy('actualizadoMs', 'desc').limit(limite).get();
  return snap.docs.map(d => {
    const x = d.data();
    return { id: d.id, origen: x.origen, titulo: x.titulo, estado: x.estado, actualizadoMs: x.actualizadoMs, ultimoCliente: x.ultimoCliente || '', mensajes: x.mensajes || 0 };
  });
}

export const RESPONDE = '↩️ Respondé este mensaje para contestarle.';

// Botones de un aviso de chat: entrar a la charla + tomar el control / devolvérselo a la IA (los dos últimos los
// atiende /api/telegram-webhook/; el chat sale de telegram_mensajes porque el id no entra en los 64 bytes).
export const filasChat = (id, extra = []) => [
  [{ texto: '💬 Entrar al chat', url: linkAdminChat(id) }, ...extra],
  [{ texto: '🙋 Tomar el control', data: 'chat_yo' }, { texto: '🤖 Devolver a la IA', data: 'chat_ia' }],
];

// Aviso a Telegram con el botón para entrar al chat (lo llama cada origen en el primer mensaje del cliente).
export async function avisarChat({ id, texto, extra = [], send = sendTelegram, db = null }) {
  try {
    const r = await send({ texto: `${texto}

${RESPONDE}`, filas: filasChat(id, extra) });
    if (r?.ok && db) await recordarMensaje(db, r.messageId, { tipo: 'chat', id });
    return r;
  } catch {
    return null;
  }
}

async function reenviarATelegram(db, id, { titulo, texto }) {
  const r = await sendTelegram({ texto: `💬 ${titulo}:
"${texto.slice(0, 1500)}"

${RESPONDE}`, filas: filasChat(id) });
  if (r?.ok) await recordarMensaje(db, r.messageId, { tipo: 'chat', id });
}
