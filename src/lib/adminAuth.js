import { getUserFromRequest } from '@/lib/authServer';
import { isAdminEmail } from '@/lib/mcp/config';

// La cuenta admin es UNA: ADMIN_EMAIL (desde 2026-11-26, marianoaliandri@gmail.com). Toda ruta que necesite
// saber si un usuario es admin usa esto, nunca un email escrito en el código.
export { isAdminEmail };

// Guard para rutas de admin. Devuelve { user } si el request trae un idToken de
// Firebase válido cuyo email (verificado) coincide con ADMIN_EMAIL, o
// { response } con el 401/403 listo para retornar.
// Sin ADMIN_EMAIL seteada deniega todo (falla cerrado, sin fallback hardcodeado).
export async function requireAdmin(request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { response: Response.json({ error: 'No autenticado' }, { status: 401 }) };
  }

  const isAdmin = user.emailVerified && isAdminEmail(user.email);
  if (!isAdmin) {
    return { response: Response.json({ error: 'No autorizado' }, { status: 403 }) };
  }

  return { user };
}
