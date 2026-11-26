export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/lib/adminAuth';

// Puerta del panel /admin (desde 2026-11-26 se entra SOLO con Google): 200 si la sesión de Firebase es la
// cuenta ADMIN_EMAIL con el email verificado; 401 sin sesión, 403 con otra cuenta.
export async function GET(request) {
  const { user, response } = await requireAdmin(request);
  if (response) return response;
  return Response.json({ ok: true, email: user.email }, { headers: { 'Cache-Control': 'no-store' } });
}
