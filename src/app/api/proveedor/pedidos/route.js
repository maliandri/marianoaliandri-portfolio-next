import { getDb } from '@/lib/firebase-admin';
import { requireProveedorAccess } from '@/lib/proveedorAuth';

export const dynamic = 'force-dynamic';

// GET  /api/proveedor/pedidos       → pedidos guardados (más nuevos primero)
// POST /api/proveedor/pedidos       → guarda un pedido { id?, nombre, renglones }
// DELETE /api/proveedor/pedidos?id= → borra un pedido
export async function GET(request) {
  const { response } = await requireProveedorAccess(request);
  if (response) return response;
  const snap = await getDb().collection('proveedor_pedidos').where('proveedor', '==', 'moodfit').get();
  const pedidos = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.actualizadoEn || '').localeCompare(a.actualizadoEn || ''));
  return Response.json({ pedidos });
}

function limpiarRenglones(renglones) {
  if (!Array.isArray(renglones)) return null;
  const out = [];
  for (const r of renglones.slice(0, 1000)) {
    const cantidad = Math.floor(Number(r?.cantidad));
    const precioMayor = Number(r?.precioMayor);
    if (!r?.productId || !(cantidad > 0) || !Number.isFinite(precioMayor)) return null;
    out.push({
      productId: String(r.productId).slice(0, 120),
      codigo: r.codigo ? String(r.codigo).slice(0, 40) : null,
      titulo: String(r.titulo || '').slice(0, 300),
      talle: String(r.talle || '').slice(0, 30),
      color: String(r.color || '').slice(0, 60),
      cantidad,
      precioMayor,
      precioSugerido: Number.isFinite(Number(r.precioSugerido)) ? Number(r.precioSugerido) : null,
    });
  }
  return out;
}

export async function POST(request) {
  const { user, response } = await requireProveedorAccess(request);
  if (response) return response;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: 'JSON inválido' }, { status: 400 }); }

  const renglones = limpiarRenglones(body.renglones);
  if (!renglones || !renglones.length) return Response.json({ error: 'Renglones inválidos' }, { status: 400 });

  const ahora = new Date().toISOString();
  const total = renglones.reduce((s, r) => s + r.cantidad * r.precioMayor, 0);
  const col = getDb().collection('proveedor_pedidos');
  const ref = body.id ? col.doc(String(body.id)) : col.doc();
  const prev = body.id ? await ref.get() : null;
  if (body.id && !prev.exists) return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });

  await ref.set({
    proveedor: 'moodfit',
    nombre: String(body.nombre || '').slice(0, 120),
    renglones,
    total,
    unidades: renglones.reduce((s, r) => s + r.cantidad, 0),
    creadoPor: prev?.data()?.creadoPor || user.email,
    creadoEn: prev?.data()?.creadoEn || ahora,
    actualizadoPor: user.email,
    actualizadoEn: ahora,
  });
  return Response.json({ id: ref.id });
}

export async function DELETE(request) {
  const { response } = await requireProveedorAccess(request);
  if (response) return response;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Falta id' }, { status: 400 });
  await getDb().collection('proveedor_pedidos').doc(id).delete();
  return Response.json({ ok: true });
}
