export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/lib/adminAuth';
import { postToMakeSocial } from '@/lib/makeSocial';
import { getDb } from '@/lib/firebase-admin';
import { withAuditCard } from '@/lib/auditCardPublish';

// Solo la cuenta admin: antes cualquiera podía publicar en las redes con esta URL.
export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  try {
    const body = await request.json();
    // Auditorías: la imagen es la tarjeta dibujada (igual que en la publicación automática); si no se
    // puede armar, no se publica nada.
    const data = body?.metadata?.topic === 'auditoria' ? await withAuditCard(getDb(), body) : body;
    await postToMakeSocial(data);
    return Response.json({ success: true, message: 'Publicación enviada correctamente' });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
