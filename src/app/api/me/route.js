export const dynamic = 'force-dynamic';

import { getUserFromRequest } from '@/lib/authServer';
import { getEntitlement } from '@/lib/entitlements';

// GET /api/me → devuelve el plan y la cuota del usuario autenticado.
// Requiere header Authorization: Bearer <idToken>.
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 });
    }

    const ent = await getEntitlement(user.uid);
    if (!ent) {
      return Response.json({ error: 'DB no disponible' }, { status: 500 });
    }

    return Response.json({
      uid: user.uid,
      email: user.email,
      plan: ent.plan,
      planStatus: ent.planStatus,
      planRenewsAt: ent.planRenewsAt,
      remaining: ent.remaining, // null = ilimitado
      limit: ent.limit,
    });
  } catch (e) {
    console.error('[me] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
