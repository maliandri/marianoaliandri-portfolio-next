import { getUserFromRequest } from '@/lib/authServer';

// Guard para rutas de admin. Devuelve { user } si el request trae un idToken de
// Firebase válido cuyo email (verificado) coincide con ADMIN_EMAIL, o
// { response } con el 401/403 listo para retornar.
// Sin ADMIN_EMAIL seteada deniega todo (falla cerrado, sin fallback hardcodeado).
export async function requireAdmin(request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { response: Response.json({ error: 'No autenticado' }, { status: 401 }) };
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const isAdmin = adminEmail
    && user.emailVerified
    && (user.email || '').toLowerCase() === adminEmail;
  if (!isAdmin) {
    return { response: Response.json({ error: 'No autorizado' }, { status: 403 }) };
  }

  return { user };
}
