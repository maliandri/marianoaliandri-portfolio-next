export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { leerChat, mensajesDesde, idValido } from '@/lib/chatVivo';

// Lo consulta el navegador del cliente cada pocos segundos: GET ?id=<chat>&desde=<ms> → { estado, mensajes }
// con SOLO lo que escribió Mariano después de `desde` (el resto ya lo tiene el cliente). El id es aleatorio y
// lo genera el propio navegador: quien lo tiene es el dueño de esa charla.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const desde = Number(searchParams.get('desde')) || 0;
  if (!idValido(id)) return Response.json({ error: 'chat inválido' }, { status: 400 });
  const db = getDb();
  if (!db) return Response.json({ estado: 'ia', mensajes: [] });
  const chat = await leerChat(db, id);
  if (!chat) return Response.json({ estado: 'ia', mensajes: [] }, { headers: { 'Cache-Control': 'no-store' } });
  // Sin mensajes nuevos de Mariano no hace falta leer la subcolección.
  const mensajes = (chat.ultimoMarianoMs || 0) > desde
    ? (await mensajesDesde(db, id, desde, { soloRol: 'mariano' })).map(m => ({ texto: m.texto, ms: m.ms }))
    : [];
  return Response.json({ estado: chat.estado || 'ia', mensajes }, { headers: { 'Cache-Control': 'no-store' } });
}
