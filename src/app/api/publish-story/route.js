export const dynamic = 'force-dynamic';
// Los videos tardan en procesarse del lado de Instagram (se espera a FINISHED antes de publicar).
export const maxDuration = 180;

import { getDb } from '@/lib/firebase-admin';
import { requireAdmin } from '@/lib/adminAuth';
import { buildStoryMedia, publishStory, STORY_TIPOS } from '@/lib/igStory';

// POST { tipo: 'texto'|'imagen'|'video', titulo?, etiqueta?, mediaUrl?, dryRun? }
// dryRun: true → solo arma la imagen/video 9:16 y devuelve { previewUrl } (no publica).
// Sin dryRun → publica { mediaUrl } ya armado (el previewUrl de la vista previa) o lo arma y publica.
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  try {
    const body = await request.json();

    let media;
    if (!body.dryRun && body.previewUrl) {
      if (!STORY_TIPOS.includes(body.tipo) || !/^https:\/\/res\.cloudinary\.com\//.test(body.previewUrl)) {
        return Response.json({ error: 'previewUrl inválida' }, { status: 400 });
      }
      media = { tipo: body.tipo, mediaUrl: body.previewUrl };
    } else {
      media = await buildStoryMedia(body);
      if (media.error) return Response.json({ error: media.error }, { status: 400 });
    }

    if (body.dryRun) return Response.json({ previewUrl: media.mediaUrl });

    const { storyId } = await publishStory({ db: getDb(), tipo: media.tipo, mediaUrl: media.mediaUrl });
    return Response.json({ ok: true, storyId, previewUrl: media.mediaUrl });
  } catch (e) {
    console.error('[publish-story]', e.message);
    return Response.json({ error: e.message }, { status: 502 });
  }
}
