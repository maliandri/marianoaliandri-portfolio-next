import { z } from 'zod';
import { ESTADO_IDS } from '@/lib/igProspectos';
import { listProspectos, updateProspecto } from '@/lib/igProspectosStore';
import { defineTool, ToolError } from '../defineTool';

// Prospectos de Instagram: el DM se manda A MANO (Instagram banea el envío automático).
const out = (p) => ({
  handle: p.handle, nombre: p.nombre || null, ciudad: p.ciudad || null, rubro: p.tipo || null,
  estado: p.estado, dm: p.dm || null, notas: p.notas || null,
  chatUrl: `https://ig.me/m/${p.handle}`, contactado: p.contactadoAt || null,
});

export const listIgProspectsTool = defineTool({
  name: 'list_ig_prospects',
  title: 'Prospectos de Instagram',
  description:
    'Negocios con Instagram a contactar por DM, con el DM sugerido y el link al chat (ig.me). Los DMs los manda '
    + 'Mariano a mano desde el celular: esta tool no manda nada. Filtrable por estado, paginado.',
  inputSchema: z.object({
    estado: z.enum(ESTADO_IDS).optional().describe(`Estado: ${ESTADO_IDS.join(', ')}.`),
    cursor: z.string().optional().describe('nextCursor de la llamada anterior.'),
    limit: z.number().int().min(1).max(50).optional().describe('Cuántos (default 20, máx 50).'),
  }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const r = await listProspectos(db, { estado: args.estado, limit: args.limit ?? 20, cursor: args.cursor || null });
    return { summary: `${r.items.length} prospectos${r.nextCursor ? ' (hay más)' : ''}.`, data: { items: r.items.map(out), nextCursor: r.nextCursor } };
  },
});

export const updateIgProspectTool = defineTool({
  name: 'update_ig_prospect',
  title: 'Actualizar prospecto de Instagram',
  description:
    'Cambia el estado, el DM sugerido o las notas de un prospecto de Instagram (ej. marcar "contactado" después de '
    + 'que Mariano mandó el DM). NO manda ningún mensaje a Instagram.',
  inputSchema: z.object({
    handle: z.string().max(30).describe('Usuario de Instagram sin @.'),
    estado: z.enum(ESTADO_IDS).optional().describe(`Nuevo estado: ${ESTADO_IDS.join(', ')}.`),
    dm: z.string().max(1200).optional().describe('Nuevo texto del DM sugerido.'),
    notas: z.string().max(2000).optional().describe('Notas de seguimiento.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  async handler(args, { db }) {
    const r = await updateProspecto(db, String(args.handle).replace(/^@/, '').toLowerCase(), args);
    if (r.error) throw new ToolError(r.error);
    return { summary: `@${r.item.handle}: ${r.item.estado}.`, data: out(r.item) };
  },
});

export const INSTAGRAM_TOOLS = [listIgProspectsTool, updateIgProspectTool];
