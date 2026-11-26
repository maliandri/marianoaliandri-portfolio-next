export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { requireAdmin } from '@/lib/adminAuth';
import { comprobarClaves } from '@/lib/aiKeysCheck';

// Admin → Marketing → Claves de IA. Prueba en vivo cada clave de Gemini y Groq (un pedido mínimo por clave y
// modelo). Nunca devuelve las claves, solo el nombre de la variable y los últimos 4 caracteres.
export async function GET(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  try {
    return Response.json(await comprobarClaves(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[ai-keys]', e?.message);
    return Response.json({ error: 'No se pudieron probar las claves' }, { status: 500 });
  }
}
