export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { urlConsentimiento, verificarState, conectar, INTEGRACION } from '@/lib/googleCalendar';
import { alertError } from '@/lib/alert';

const SITE = process.env.MCP_BASE_URL || 'https://marianoaliandri.com.ar';

// Conexión del Google Calendar de Mariano (Meet de la venta por consulta).
//   GET (admin, con Bearer)        → { conectado, url }  (url = pantalla de consentimiento de Google)
//   GET ?code=&state= (callback)   → guarda el refresh token y vuelve al admin
// Redirect URI registrado en Google Cloud: https://marianoaliandri.com.ar/api/google-calendar-auth/ (con barra).
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const db = getDb();

  if (code || url.searchParams.get('error')) {
    const vuelta = (estado) => Response.redirect(`${SITE}/admin/?gcal=${estado}`, 302);
    if (!code || !verificarState(url.searchParams.get('state'), process.env.GOOGLE_CLIENT_SECRET)) return vuelta('error');
    try {
      await conectar(db, code);
      return vuelta('ok');
    } catch (e) {
      await alertError('gcal:conectar', 'No se pudo conectar Google Calendar', e);
      return vuelta('error');
    }
  }

  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return Response.json({ error: 'Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en Vercel' }, { status: 503 });
  }
  const snap = await db.collection(INTEGRACION[0]).doc(INTEGRACION[1]).get();
  return Response.json(
    { conectado: snap.exists && !!snap.data()?.refreshToken, url: urlConsentimiento() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
