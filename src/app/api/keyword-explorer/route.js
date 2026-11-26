export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { RUBROS } from '@/data/rubros';
import { analyzeAll, rankAnalyzed } from '@/lib/rubroDemand';
import { getUserFromRequest } from '@/lib/authServer';
import { consumeSearch } from '@/lib/entitlements';
import { isAdminEmail } from '@/lib/adminAuth';

// Cuenta admin registrada (misma que /api/lead-finder) — sin límite de cuota acá.
// El autocompletado de Google es gratis (sin riesgo de facturación como Places API),
// así que el único motivo del límite es evitar abuso de terceros, no el costo.

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const localidad = (body?.localidad || '').trim();
    if (!localidad) {
      return Response.json({ error: 'Falta la localidad' }, { status: 400 });
    }

    let quota;
    {
      // 1) Autenticación: requiere idToken de Firebase (no se puede evadir desde el cliente)
      const user = await getUserFromRequest(request);
      if (!user) {
        return Response.json({ error: 'Necesitás iniciar sesión', reason: 'auth' }, { status: 401 });
      }

      // 2) Cuota: consume una búsqueda del plan del usuario (transacción atómica) —
      // salvo la cuenta admin, que no tiene límite.
      const isAdmin = user.emailVerified && isAdminEmail(user.email);
      quota = isAdmin ? { allowed: true, plan: 'admin', remaining: null } : await consumeSearch(user.uid);
    }
    if (!quota.allowed) {
      const status = quota.reason === 'db_unavailable' ? 500 : 402;
      return Response.json(
        {
          error:
            quota.reason === 'limit'
              ? 'Alcanzaste el límite de búsquedas de tu plan este mes'
              : 'Usaste tu búsqueda gratis. Suscribite para seguir buscando',
          reason: quota.reason,
          plan: quota.plan,
          remaining: 0,
        },
        { status }
      );
    }

    // Permite filtrar por ids de rubro; si no vienen, analiza todos.
    const ids = Array.isArray(body?.rubroIds) && body.rubroIds.length ? new Set(body.rubroIds) : null;
    const target = ids ? RUBROS.filter(r => ids.has(r.id)) : RUBROS;

    const ranked = rankAnalyzed(await analyzeAll(localidad, target));

    const withData = ranked.filter(r => r.count > 0).length;

    return Response.json({
      localidad,
      provincia: body?.provincia || null,
      total: ranked.length,
      withData,
      results: ranked,
      plan: quota.plan,
      remaining: quota.remaining, // null = ilimitado
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[keyword-explorer] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
