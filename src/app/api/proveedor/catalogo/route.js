import { getDb } from '@/lib/firebase-admin';
import { requireProveedorAccess } from '@/lib/proveedorAuth';

export const dynamic = 'force-dynamic';

// GET /api/proveedor/catalogo → productos activos del proveedor + última sincronización.
export async function GET(request) {
  const { response } = await requireProveedorAccess(request);
  if (response) return response;

  const db = getDb();
  if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

  const [prods, syncs] = await Promise.all([
    db.collection('proveedor_productos').where('proveedor', '==', 'moodfit').where('activo', '==', true).get(),
    db.collection('proveedor_syncs').where('proveedor', '==', 'moodfit').get(),
  ]);

  const productos = prods.docs
    .map((d) => {
      const { historialPrecios, ...rest } = d.data();
      return { id: d.id, ...rest };
    })
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));

  const ultimaSync = syncs.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''))[0] || null;

  return Response.json({ productos, ultimaSync });
}
