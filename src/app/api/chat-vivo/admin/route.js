export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { leerChat, mensajesDesde, listarChats, registrarMensaje, cambiarEstado, idValido } from '@/lib/chatVivo';

// Pantalla /admin/chat/<id>/ (link de Telegram). Solo la cuenta admin.
// GET ?id=&desde= → { chat, mensajes } | GET sin id → { chats } (los últimos)
// POST { id, texto } → manda un mensaje de Mariano (y toma el control) | POST { id, estado: 'ia'|'humano' }
export async function GET(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ chats: await listarChats(db) }, { headers: { 'Cache-Control': 'no-store' } });
  if (!idValido(id)) return Response.json({ error: 'chat inválido' }, { status: 400 });
  const chat = await leerChat(db, id);
  if (!chat) return Response.json({ chat: null, mensajes: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const mensajes = await mensajesDesde(db, id, Number(searchParams.get('desde')) || 0, { limite: 500 });
  const { expiraEn: _e, ...resto } = chat;
  return Response.json({ chat: resto, mensajes }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '');
  if (!idValido(id)) return Response.json({ error: 'chat inválido' }, { status: 400 });
  if (!(await leerChat(db, id))) return Response.json({ error: 'Ese chat todavía no existe' }, { status: 404 });
  if (body.estado) {
    await cambiarEstado(db, id, body.estado);
    return Response.json({ ok: true, estado: body.estado });
  }
  const texto = String(body?.texto || '').trim();
  if (!texto) return Response.json({ error: 'Mensaje vacío' }, { status: 400 });
  await cambiarEstado(db, id, 'humano'); // si escribe Mariano, la IA se calla
  await registrarMensaje(db, id, { rol: 'mariano', texto });
  return Response.json({ ok: true, estado: 'humano' });
}
