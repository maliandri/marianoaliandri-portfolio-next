export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/lib/adminAuth';
import { fetchFunnels } from '@/lib/siteStats';
import { FUNNELS, CONTACT_EVENTS } from '@/data/funnels';

// GET ?days=7|28|90 → embudos de conversión (GA4, personas sin bots). Solo admin.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const days = [7, 28, 90].includes(Number(new URL(request.url).searchParams.get('days')))
    ? Number(new URL(request.url).searchParams.get('days')) : 28;
  try {
    return Response.json(await fetchFunnels({ days, funnels: FUNNELS, contacts: CONTACT_EVENTS }));
  } catch (e) {
    console.error('[funnels]', e.message);
    return Response.json({ error: 'No se pudo leer Google Analytics' }, { status: 502 });
  }
}
