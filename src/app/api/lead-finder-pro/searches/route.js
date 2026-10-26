export const dynamic = 'force-dynamic';

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { listSearches, getSearch, saveSearch, deleteSearch } from '@/lib/leadSearchesStore';

// Historial de búsquedas por cliente (lógica en src/lib/leadSearchesStore.js, compartida con el MCP).

export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  const id = new URL(request.url).searchParams.get('id');
  if (id) {
    const search = await getSearch(db, user.uid, id);
    if (!search) return Response.json({ error: 'No encontrada' }, { status: 404 });
    return Response.json(search);
  }

  const { items } = await listSearches(db, user.uid, { limit: 20 });
  return Response.json({ items });
}

export async function POST(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }
  if (!Array.isArray(body.results) || !body.results.length) return Response.json({ error: 'results vacío' }, { status: 400 });

  const isAdmin = !!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL;
  // `via` no se acepta desde el navegador: solo lo marca el servidor MCP.
  const { via: _via, ...fields } = body;
  const id = await saveSearch(db, user.uid, fields, { isAdmin });

  return Response.json({ success: true, id });
}

export async function DELETE(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });

  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  await deleteSearch(db, user.uid, id);
  return Response.json({ success: true });
}
