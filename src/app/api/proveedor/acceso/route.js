import { getUserFromRequest } from '@/lib/authServer';
import { proveedorAllowedEmails } from '@/lib/proveedorAuth';

export const dynamic = 'force-dynamic';

// GET /api/proveedor/acceso → { acceso: boolean } para mostrar el link a /compras/moodfit
// en el panel del cliente. El control real de acceso lo hacen las otras rutas.
export async function GET(request) {
  const user = await getUserFromRequest(request);
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
  const acceso = user.emailVerified && proveedorAllowedEmails().includes((user.email || '').toLowerCase());
  return Response.json({ acceso });
}
