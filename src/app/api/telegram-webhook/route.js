export const dynamic = 'force-dynamic';
export const maxDuration = 300; // aprobar un borrador de auditoría arma la tarjeta y publica: puede tardar

import { after } from 'next/server';
import { getDb } from '@/lib/firebase-admin';
import { sendTelegram, editTelegram, answerCallback } from '@/lib/telegram';
import { buscarMensaje } from '@/lib/avisos';
import { registrarMensaje, cambiarEstado, leerChat } from '@/lib/chatVivo';
import { aprobarBorrador, descartarBorrador } from '@/lib/autoAuditReview';
import { publicarContenido } from '@/lib/contenidoRun';
import { publicarReel } from '@/lib/reelPublish';
import { sendBusinessEmailTool } from '@/lib/mcp/tools/email';
import { alertError } from '@/lib/alert';

// Webhook del bot de Telegram (2026-11-27): lo que Mariano hace desde el celular.
// - Botones de los avisos (callback_query): publicar o descartar un borrador de auditoría, publicar una pieza o un
//   reel, mandar un mail del agente (todos piden confirmación con un segundo botón) y tomar/devolver un chat.
// - Responder un aviso de chat: le contesta al cliente (toma el control del chat, la IA se calla).
// Seguridad: Telegram manda X-Telegram-Bot-Api-Secret-Token (= TELEGRAM_WEBHOOK_SECRET, se fija con setWebhook en
// scripts/telegram-setup.mjs) y solo se atiende el chat de Mariano (TELEGRAM_CHAT_ID). URL CON barra final.

// accion → { pregunta, hacer(db, arg) → texto del resultado }
const ACCIONES = {
  aud_pub: {
    pregunta: '¿Publico este informe de auditoría (con redes)?',
    hacer: async (db, id) => {
      const r = await aprobarBorrador(db, id, { redes: true });
      return `✅ Auditoría publicada (${r.sitios} sitios)${r.error ? `\n⚠️ ${r.error}` : ''}`;
    },
  },
  aud_desc: {
    pregunta: '¿Descarto este lote de la auditoría automática?',
    hacer: async (db, id) => { await descartarBorrador(db, id, 'Descartado desde Telegram'); return '🗑 Lote descartado.'; },
  },
  cont_pub: {
    pregunta: '¿Publico esta pieza en Facebook, Instagram y LinkedIn?',
    hacer: async (db, id) => {
      const r = await publicarContenido(db, id);
      return r.error ? `⚠️ Publicada con fallas: ${r.error}` : '✅ Pieza publicada.';
    },
  },
  reel_pub: {
    pregunta: '¿Publico este reel en Instagram, Facebook y LinkedIn?',
    hacer: async (db, id) => {
      const r = await publicarReel(db, id);
      return r.error ? `⚠️ Publicado con fallas: ${r.error}` : '✅ Reel publicado.';
    },
  },
  mail_env: {
    pregunta: '¿Mando este mail? (pasa por todos los frenos: bajas, rebotes, 30 días, tope diario)',
    hacer: async (db, id) => {
      const { summary } = await sendBusinessEmailTool.handler({ draft_id: id }, {
        db, user: { uid: 'telegram', email: process.env.ADMIN_EMAIL || 'admin' }, now: new Date(),
      });
      return `✉️ ${summary}`;
    },
  },
};

const AYUDA = 'Hola 👋 Soy el bot del sitio. Te aviso de pagos, pedidos, clientes que abren su auditoría o su presupuesto, '
  + 'y cosas para revisar. Tocá los botones de cada aviso para publicar o mandar desde acá, y respondé un aviso de chat para '
  + 'contestarle al cliente.';

export async function POST(request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return Response.json({ ok: false }, { status: 503 });
  if (request.headers.get('x-telegram-bot-api-secret-token') !== secret) return Response.json({ ok: false }, { status: 401 });

  const update = await request.json().catch(() => ({}));
  const miChat = String(process.env.TELEGRAM_CHAT_ID || '');
  const db = getDb();
  if (!db) return Response.json({ ok: true });

  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      if (String(cq.message?.chat?.id) !== miChat) { await answerCallback(cq.id, 'No autorizado'); return Response.json({ ok: true }); }
      await atenderBoton(db, cq);
    } else if (update.message) {
      const m = update.message;
      if (String(m.chat?.id) !== miChat) return Response.json({ ok: true });
      await atenderMensaje(db, m);
    }
  } catch (e) {
    await alertError('telegram-webhook', 'Webhook de Telegram falló', e);
  }
  // Siempre 200: si no, Telegram reintenta el mismo update una y otra vez.
  return Response.json({ ok: true });
}

async function atenderBoton(db, cq) {
  const data = String(cq.data || '');
  const msgId = cq.message?.message_id;

  // Tomar / devolver un chat: el chat sale de la asociación del mensaje (el id no entra en los 64 bytes del botón).
  if (data === 'chat_yo' || data === 'chat_ia') {
    const ref = await buscarMensaje(db, msgId);
    if (ref?.tipo !== 'chat') return answerCallback(cq.id, 'No encuentro ese chat');
    if (!(await leerChat(db, ref.id))) return answerCallback(cq.id, 'Todavía no escribió en el chat');
    await cambiarEstado(db, ref.id, data === 'chat_yo' ? 'humano' : 'ia');
    return answerCallback(cq.id, data === 'chat_yo' ? 'Listo: la IA se calla. Respondé el aviso para escribirle.' : 'Listo: vuelve a contestar la IA.');
  }

  if (data === 'no') {
    await answerCallback(cq.id, 'Cancelado');
    return editTelegram({ messageId: msgId, texto: '✖️ Cancelado.' });
  }

  // Confirmado: "ok:<accion>:<id>" → se hace en segundo plano y se cuenta el resultado en el mismo mensaje.
  if (data.startsWith('ok:')) {
    const [, accion, id] = data.split(':');
    const a = ACCIONES[accion];
    if (!a || !id) return answerCallback(cq.id, 'Acción desconocida');
    await answerCallback(cq.id, 'En eso…');
    await editTelegram({ messageId: msgId, texto: '⏳ En eso…' });
    after(async () => {
      let texto;
      try {
        texto = await a.hacer(db, id);
      } catch (e) {
        texto = `⚠️ No se pudo: ${String(e?.message || e).slice(0, 500)}`;
      }
      await editTelegram({ messageId: msgId, texto });
    });
    return null;
  }

  // Primer toque: se pide confirmación (respondiendo al aviso, así se ve a qué corresponde).
  const [accion, id] = data.split(':');
  const a = ACCIONES[accion];
  if (!a || !id) return answerCallback(cq.id, 'Acción desconocida');
  await answerCallback(cq.id);
  return sendTelegram({
    texto: a.pregunta,
    responderA: msgId,
    botones: [{ texto: 'Sí, dale', data: `ok:${accion}:${id}` }, { texto: 'No', data: 'no' }],
  });
}

async function atenderMensaje(db, m) {
  const texto = String(m.text || '').trim();
  const respondido = m.reply_to_message?.message_id;
  if (respondido && texto) {
    const ref = await buscarMensaje(db, respondido);
    if (ref?.tipo === 'chat') {
      if (!(await leerChat(db, ref.id))) return sendTelegram({ texto: 'Todavía no escribió en el chat (o ya se borró): no hay a quién mandárselo.', responderA: m.message_id });
      await cambiarEstado(db, ref.id, 'humano'); // si escribe Mariano, la IA se calla
      await registrarMensaje(db, ref.id, { rol: 'mariano', texto });
      return sendTelegram({ texto: '✓ Le llegó. La IA quedó en pausa en ese chat.', responderA: m.message_id, silencioso: true });
    }
    return sendTelegram({ texto: 'Ese mensaje no es de un chat: no tengo a quién mandárselo.', responderA: m.message_id });
  }
  return sendTelegram({ texto: AYUDA });
}
