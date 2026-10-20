import { getUserFromRequest } from '@/lib/authServer';

// Guard de la sección privada de compras a proveedores (/compras/moodfit).
// Pasa si el idToken es válido, el email está verificado y es ADMIN_EMAIL o está en
// PROVEEDOR_ALLOWED_EMAILS (separados por coma). Falla cerrado si ninguna está seteada.
export function proveedorAllowedEmails() {
  return [process.env.ADMIN_EMAIL, ...(process.env.PROVEEDOR_ALLOWED_EMAILS || '').split(',')]
    .map((e) => (e || '').trim().toLowerCase())
    .filter(Boolean);
}

export async function requireProveedorAccess(request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { response: Response.json({ error: 'No autenticado' }, { status: 401 }) };
  }
  const email = (user.email || '').toLowerCase();
  if (!user.emailVerified || !proveedorAllowedEmails().includes(email)) {
    return { response: Response.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return { user };
}
