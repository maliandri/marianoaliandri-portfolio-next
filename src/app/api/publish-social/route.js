export const dynamic = 'force-dynamic';

import { requireAdmin } from '@/lib/adminAuth';
import { postToMakeSocial } from '@/lib/makeSocial';

// Solo la cuenta admin: antes cualquiera podía publicar en las redes con esta URL.
export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  try {
    const data = await request.json();
    await postToMakeSocial(data);
    return Response.json({ success: true, message: 'Publicación enviada correctamente' });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
