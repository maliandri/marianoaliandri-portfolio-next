import { z } from 'zod';
import { igCredsFromEnv } from '../../../../scripts/igStoryClient.mjs';
import { linkedinExpiry } from '@/lib/linkedinClient';
import { fetchInstagramStats, listLinkedInPosts, snapshotSeguidores, SocialStatsError } from '@/lib/socialStats';
import { defineTool, ToolError } from '../defineTool';

const dias = z.union([z.literal(7), z.literal(28)]).optional().describe('Período en días: 7 o 28 (default 28).');

export const getInstagramStatsTool = defineTool({
  name: 'get_instagram_stats',
  title: 'Estadísticas de Instagram',
  description:
    'Cómo viene el Instagram de Mariano (cuenta Business): seguidores, publicaciones, últimos posts con likes y '
    + 'comentarios y su link, y la evolución de seguidores día a día (se guarda una foto por día cada vez que se '
    + 'consulta). Si el token tiene permiso de insights suma alcance, vistas, interacciones, guardados y '
    + 'compartidos de la cuenta y de cada post; si no lo tiene, `insights.error` explica cómo habilitarlo. Solo lee.',
  inputSchema: z.object({
    days: dias,
    posts: z.number().int().min(1).max(25).optional().describe('Cuántos posts recientes traer (default 12, máx 25).'),
  }),
  annotations: { readOnlyHint: true, openWorldHint: true },
  async handler(args, { db, now = new Date() }) {
    let r;
    try {
      r = await fetchInstagramStats({ creds: igCredsFromEnv(), days: args.days ?? 28, posts: args.posts ?? 12, now: now.getTime() });
    } catch (e) {
      if (e instanceof SocialStatsError) throw new ToolError(e.message);
      throw e;
    }
    const evolucion = await snapshotSeguidores(db, 'instagram', r.perfil.seguidores, { now: now.getTime() });
    const c = r.insights.cuenta;
    const partes = [`@${r.perfil.usuario}: ${r.perfil.seguidores} seguidores, ${r.perfil.publicaciones} publicaciones`];
    if (c) partes.push(`últimos ${r.insights.dias} días: alcance ${c.reach ?? '—'}, interacciones ${c.total_interactions ?? '—'}`);
    if (r.insights.seguidoresNuevos != null) partes.push(`${r.insights.seguidoresNuevos} seguidores nuevos`);
    if (r.insights.error) partes.push('sin insights (falta permiso)');
    return { summary: `${partes.join('; ')}.`, data: { ...r, evolucionSeguidores: evolucion } };
  },
});

export const getLinkedInStatsTool = defineTool({
  name: 'get_linkedin_stats',
  title: 'Publicaciones de LinkedIn',
  description:
    'Lo que salió en el LinkedIn de Mariano desde el sitio (piezas del bot de contenido, reels e informes de '
    + 'demanda) con fecha y link al post, cuántas publicaciones fallaron y cuántos días le quedan a la conexión. '
    + 'Las métricas (impresiones, reacciones) todavía NO se pueden leer: LinkedIn exige aprobar la Community '
    + 'Management API para la app maliandri-analytics. Solo lee.',
  inputSchema: z.object({
    days: dias,
    limit: z.number().int().min(1).max(50).optional().describe('Cuántos posts como máximo (default 30).'),
  }),
  annotations: { readOnlyHint: true },
  async handler(args, { db, now = new Date() }) {
    const days = args.days ?? 28;
    const [posts, exp] = await Promise.all([
      listLinkedInPosts(db, { dias: days, limit: args.limit ?? 30, now: now.getTime() }),
      linkedinExpiry(db, now.getTime()),
    ]);
    const conexion = !exp ? { conectado: false }
      : { conectado: exp.dias >= 0, diasRestantes: Number.isFinite(exp.dias) ? exp.dias : null };
    const metricas = 'No disponibles: falta que LinkedIn apruebe la Community Management API (r_member_postAnalytics).';
    const estado = !conexion.conectado ? 'LinkedIn desconectado (admin → LinkedIn → Conectar)'
      : conexion.diasRestantes != null ? `conexión vence en ${conexion.diasRestantes} días` : 'conectado';
    return {
      summary: `Últimos ${days} días: ${posts.items.length} posts en LinkedIn desde el sitio${posts.fallidos ? `, ${posts.fallidos} fallidos` : ''}; ${estado}. Métricas no disponibles todavía.`,
      data: { dias: days, posts: posts.items, fallidos: posts.fallidos, conexion, metricas },
    };
  },
});

export const SOCIAL_STATS_TOOLS = [getInstagramStatsTool, getLinkedInStatsTool];
