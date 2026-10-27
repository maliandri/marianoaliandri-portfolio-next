import { z } from 'zod';
import { renderNoticiaCard } from '../../../../scripts/noticiaCard.mjs';
import { imageIsReachable } from '@/lib/imageCheck';
import { postToMakeSocial } from '@/lib/makeSocial';
import { buildFreePostPayload, MAX_CAROUSEL_IMAGES } from '@/lib/freePost';
import { feedImageUrl, isCloudinaryUrl, uploadFromUrl, uploadPng } from '@/lib/cloudinaryServer';
import { buildStoryMedia, publishStory, STORY_TIPOS } from '@/lib/igStory';
import { defineTool, ToolError } from '../defineTool';
import { claimSocialSlot } from '../socialCap';

const httpsUrl = z.string().url().max(2000).refine(u => u.startsWith('https://'), 'Tiene que ser una URL https');
const NETWORK_MAP = { linkedin: 'linkedin', facebook_instagram: 'facebook' };

// Imágenes que llegan desde el chat (URL pública cualquiera) → Cloudinary, para que Make/Instagram
// reciban siempre una URL estable en JPG.
async function toCloudinary(url, resourceType = 'image') {
  if (isCloudinaryUrl(url)) return url;
  try {
    return await uploadFromUrl(url, { resourceType, folder: 'social/mcp' });
  } catch (e) {
    throw new ToolError(`No pude bajar ${url}: ${e.message}. Tiene que ser un link público directo al archivo.`);
  }
}

const capError = (cap) => new ToolError(`Ya se hicieron ${cap} publicaciones desde el MCP hoy (tope MCP_SOCIAL_DAILY_CAP). Probá mañana o publicá desde el admin.`);

export const publishFreePostTool = defineTool({
  name: 'publish_free_post',
  title: 'Publicación libre en redes',
  description:
    'Hace una "Publicación libre" (lo mismo que admin → Redes Sociales → Publicación Libre → Post): manda el texto '
    + 'y las imágenes a Make, que publica en LinkedIn y/o Facebook + Instagram. Con 2 a 10 imágenes es un carrusel '
    + '(solo Facebook + Instagram; LinkedIn no acepta carruseles). Las imágenes van como URLs públicas (https); si no '
    + 'hay imagen, `tarjeta_titulo` arma una tarjeta de marca 4:5 con ese texto. Para Facebook + Instagram hace falta '
    + 'una imagen o una tarjeta. PUBLICA DE VERDAD en las redes de Mariano: primero llamala con dry_run: true, mostrale '
    + 'a Mariano el texto y las imágenes, y publicá solo cuando te lo confirme.',
  inputSchema: z.object({
    texto: z.string().min(1).max(2200).describe('Texto del post, tal cual se publica (máx. 2.200 por Instagram).'),
    redes: z.array(z.enum(['linkedin', 'facebook_instagram'])).min(1).max(2)
      .describe('linkedin y/o facebook_instagram (Facebook + Instagram juntos).'),
    imagenes: z.array(httpsUrl).max(MAX_CAROUSEL_IMAGES).optional()
      .describe('URLs públicas de las imágenes, en orden. 2 o más = carrusel. Se ajustan a 4:5.'),
    tarjeta_titulo: z.string().min(3).max(150).optional()
      .describe('Si no hay imágenes: título para una tarjeta de marca 4:5 generada automáticamente.'),
    tarjeta_etiqueta: z.string().max(34).optional().describe('Etiqueta chica arriba de la tarjeta (default "Mariano Aliandri").'),
    usar_ia: z.boolean().optional().describe('true = Make reescribe el texto con Gemini (no aplica a carruseles).'),
    dry_run: z.boolean().optional().describe('true = prepara y verifica las imágenes, pero no publica.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  async handler(args, { db }) {
    const networks = args.redes.map(r => NETWORK_MAP[r]);
    let images = [];
    if (args.imagenes?.length) {
      for (const url of args.imagenes) images.push(feedImageUrl(await toCloudinary(url)));
    } else if (args.tarjeta_titulo) {
      const { png } = await renderNoticiaCard({
        title: args.tarjeta_titulo, topicLabel: args.tarjeta_etiqueta?.trim() || 'Mariano Aliandri', topicId: 'publicacion-libre',
      });
      images = [(await uploadPng(png, 'social/mcp')).replace('/image/upload/', '/image/upload/f_jpg,q_auto/')];
    }
    if (networks.includes('facebook') && !images.length) {
      throw new ToolError('Para Facebook + Instagram hace falta una imagen (imagenes) o una tarjeta (tarjeta_titulo).');
    }
    const isCarousel = images.length > 1;
    if (isCarousel && !networks.includes('facebook')) {
      throw new ToolError('Los carruseles se publican solo en Facebook + Instagram: agregá facebook_instagram a redes.');
    }

    // Cloudinary arma cada versión JPG en el primer pedido: se piden antes para que Instagram no falle (9004).
    for (const url of images) {
      const check = await imageIsReachable(url);
      if (!check.ok) throw new ToolError(`Una imagen no está lista (${check.detail}); no se publicó. Probá de nuevo en un rato.`);
    }

    const payload = buildFreePostPayload({ text: args.texto, networks, images, useAI: args.usar_ia });
    const destino = payload.networks.map(n => (n === 'facebook' ? 'Facebook + Instagram' : 'LinkedIn')).join(' y ');
    const tipo = isCarousel ? `carrusel de ${images.length} imágenes` : images.length ? 'post con imagen' : 'post de texto';
    if (args.dry_run) {
      return {
        summary: `Prueba: ${tipo} en ${destino}${isCarousel && networks.includes('linkedin') ? ' (LinkedIn se saltea: no acepta carruseles)' : ''}. No se publicó.`,
        data: { dryRun: true, tipo, redes: payload.networks, imagenes: images, texto: args.texto, usarIa: payload.useAI },
      };
    }

    const slot = await claimSocialSlot(db);
    if (!slot.ok) throw capError(slot.cap);
    await postToMakeSocial(payload, { timeoutMs: 10000 });
    return {
      summary: `Enviado a Make: ${tipo} en ${destino}. Make acepta el pedido antes de publicar: confirmá en las redes.`,
      data: { enviado: true, tipo, redes: payload.networks, imagenes: images },
    };
  },
});

export const publishIgStoryTool = defineTool({
  name: 'publish_ig_story',
  title: 'Publicar historia de Instagram',
  description:
    'Publica una historia en el Instagram de Mariano (@marianoaliandri), directo con la API de Instagram (no pasa por Make). '
    + 'Tipos: "texto" = tarjeta de marca 9:16 con un texto corto; "imagen" = una imagen (URL pública) ajustada a 9:16 '
    + 'sin recortar, con fondo desenfocado; "video" = MP4 vertical (URL pública), recortado a 60 s. Las historias no '
    + 'llevan texto aparte ni links/stickers: lo que haya que decir va en la imagen. Se ve 24 h. PUBLICA DE VERDAD: '
    + 'primero llamala con dry_run: true, mostrale a Mariano la vista previa (preview_url) y publicá solo con su OK.',
  inputSchema: z.object({
    tipo: z.enum(STORY_TIPOS).describe('texto, imagen o video.'),
    texto: z.string().min(1).max(150).optional().describe('Para tipo texto: el texto de la tarjeta (máx. 150).'),
    etiqueta: z.string().max(34).optional().describe('Para tipo texto: etiqueta chica arriba (default "Mariano Aliandri").'),
    url: httpsUrl.optional().describe('Para imagen o video: URL pública del archivo.'),
    preview_url: httpsUrl.optional().describe('Para publicar exactamente lo que se vio en el dry_run: el preview_url que devolvió.'),
    dry_run: z.boolean().optional().describe('true = arma la vista previa 9:16 y devuelve preview_url, sin publicar.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  async handler(args, { db }) {
    let mediaUrl;
    if (args.preview_url && !args.dry_run) {
      if (!isCloudinaryUrl(args.preview_url)) throw new ToolError('preview_url tiene que ser el que devolvió el dry_run.');
      mediaUrl = args.preview_url;
    } else {
      const source = args.url ? await toCloudinary(args.url, args.tipo === 'video' ? 'video' : 'image') : undefined;
      const media = await buildStoryMedia({ tipo: args.tipo, titulo: args.texto, etiqueta: args.etiqueta, mediaUrl: source });
      if (media.error) throw new ToolError(media.error);
      mediaUrl = media.mediaUrl;
    }

    if (args.dry_run) {
      return {
        summary: `Vista previa lista (no se publicó): ${mediaUrl}`,
        data: { dryRun: true, tipo: args.tipo, preview_url: mediaUrl },
      };
    }

    const slot = await claimSocialSlot(db);
    if (!slot.ok) throw capError(slot.cap);
    try {
      const { storyId } = await publishStory({ db, tipo: args.tipo, mediaUrl, origen: 'mcp' });
      return { summary: `Historia publicada en Instagram (id ${storyId}).`, data: { publicada: true, storyId, preview_url: mediaUrl } };
    } catch (e) {
      throw new ToolError(`Instagram no publicó la historia: ${e.message}`);
    }
  },
});

export const SOCIAL_TOOLS = [publishFreePostTool, publishIgStoryTool];
