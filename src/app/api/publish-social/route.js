export const dynamic = 'force-dynamic';

import { postToMakeSocial } from '@/lib/makeSocial';

export async function POST(request) {
  try {
    const data = await request.json();
    await postToMakeSocial(data);
    return Response.json({ success: true, message: 'Publicación enviada correctamente' });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
