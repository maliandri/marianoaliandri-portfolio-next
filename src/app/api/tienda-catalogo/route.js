export const dynamic = 'force-dynamic';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { catalogoEfectivo } from '@/lib/tienda';
import { cargarCatalogo, CATALOGO, loadOverrides } from '@/lib/tiendaCheckout';
import { sembrarCatalogo, guardarPieza, actualizarCampos, borrarPieza } from '@/lib/tiendaCatalogo';

// Catálogo de la tienda para el admin (con precios, activas e inactivas).
//   GET                          → { items, fuente: 'firestore' | 'codigo' }
//   POST { accion: 'sembrar' }   → carga el catálogo del código en Firestore (solo si está vacío)
//   PUT  { ...pieza }            → crea o reemplaza una pieza
//   PATCH { id, ...campos }      → cambia campos sueltos (precio, activo, orden…)
//   DELETE ?id=                  → borra una pieza
const refrescar = () => { try { revalidatePath('/tienda/'); } catch { /* fuera de request */ } };

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const snap = await db.collection(CATALOGO).get();
    const fuente = snap.empty ? 'codigo' : 'firestore';
    const items = snap.empty ? catalogoEfectivo(await loadOverrides(db)) : await cargarCatalogo(db);
    return Response.json({ items, fuente }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[tienda-catalogo GET]', e.message);
    return Response.json({ error: 'No se pudo leer el catálogo' }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.accion !== 'sembrar') return Response.json({ error: 'Acción inválida' }, { status: 400 });
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const r = await sembrarCatalogo(db);
    refrescar();
    return Response.json(r);
  } catch (e) {
    console.error('[tienda-catalogo POST]', e.message);
    return Response.json({ error: 'No se pudo cargar el catálogo' }, { status: 500 });
  }
}

export async function PUT(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const r = await guardarPieza(db, await request.json().catch(() => ({})));
    if (r.error) return Response.json({ error: r.error }, { status: 400 });
    refrescar();
    return Response.json(r);
  } catch (e) {
    console.error('[tienda-catalogo PUT]', e.message);
    return Response.json({ error: 'No se pudo guardar' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const { id, ...campos } = await request.json().catch(() => ({}));
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });
    const r = await actualizarCampos(db, id, campos);
    if (r.error) return Response.json({ error: r.error }, { status: 400 });
    refrescar();
    return Response.json(r);
  } catch (e) {
    console.error('[tienda-catalogo PATCH]', e.message);
    return Response.json({ error: 'No se pudo guardar' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });
    await borrarPieza(db, id);
    refrescar();
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[tienda-catalogo DELETE]', e.message);
    return Response.json({ error: 'No se pudo borrar' }, { status: 500 });
  }
}
