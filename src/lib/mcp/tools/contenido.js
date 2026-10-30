import { z } from 'zod';
import { generarGuiones, listarGuiones, actualizarGuion, GUIONES } from '@/lib/guionesRun';
import { FORMATOS, ESTADOS_GUION, MAX_GUIONES } from '@/lib/guiones';
import { runContenido, loadContenidoConfig } from '@/lib/contenidoRun';
import { claimSocialSlot } from '../socialCap';
import { defineTool, ToolError } from '../defineTool';

// Bot de contenido desde Claude: guiones de reels para grabar con cara y "la próxima pieza".
const FORMATOS_TXT = Object.entries(FORMATOS).map(([k, v]) => `${k} (${v})`).join('; ');

export const generateReelScriptsTool = defineTool({
  name: 'generate_reel_scripts',
  title: 'Escribir guiones de reels',
  description:
    'Escribe guiones de reels para que Mariano grabe con su cara y el celular (gancho, texto en pantalla, tomas '
    + 'decir/mostrar, cierre, caption, música y tips de edición), con datos reales de sus auditorías, de lo que se '
    + 'busca en Google y de las últimas piezas del bot. Opcional: un tema ("Supabase vs planilla de Excel") y un '
    + `formato fijo. Formatos: ${FORMATOS_TXT}. Quedan guardados en admin → Bot de contenido → Guiones. `
    + 'Usa la IA con respaldo (Gemini y si está saturado, la siguiente): puede tardar 1 a 2 minutos.',
  inputSchema: z.object({
    tema: z.string().max(500).optional().describe('Sobre qué. Vacío = la IA elige con los datos y las series.'),
    cantidad: z.number().int().min(1).max(MAX_GUIONES).optional().describe('Cuántos (default 3).'),
    formato: z.enum(Object.keys(FORMATOS)).optional().describe('Forzar un formato para todos.'),
    mandar_mail: z.boolean().optional().describe('Además mandarlos por mail a Mariano (default false).'),
  }),
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(args, { db }) {
    let r;
    try {
      r = await generarGuiones(db, { cantidad: args.cantidad ?? 3, tema: args.tema || '', formato: args.formato || '', mail: args.mandar_mail === true, origen: 'mcp' });
    } catch (e) {
      throw new ToolError(`No salieron los guiones: ${e.message}`);
    }
    return {
      summary: `${r.guiones.length} guiones escritos (${r.proveedor})${r.enviado ? ' y mandados por mail' : ''}: ${r.guiones.map(g => g.titulo).join(' · ')}.`,
      data: { guiones: r.guiones, proveedor: r.proveedor, enviadoPorMail: r.enviado },
    };
  },
});

export const listReelScriptsTool = defineTool({
  name: 'list_reel_scripts',
  title: 'Ver guiones de reels',
  description: `Guiones de reels guardados, del más nuevo al más viejo, con su estado (${ESTADOS_GUION.join(', ')}). Para saber qué falta grabar, filtrá por pendiente.`,
  inputSchema: z.object({
    estado: z.enum(ESTADOS_GUION).optional().describe('Filtrar por estado.'),
    limit: z.number().int().min(1).max(30).optional().describe('Cuántos (default 10).'),
  }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const items = await listarGuiones(db, { estado: args.estado || null, limit: args.limit ?? 10 });
    return { summary: `${items.length} guiones${args.estado ? ` ${args.estado}s` : ''}.`, data: { items } };
  },
});

export const updateReelScriptTool = defineTool({
  name: 'update_reel_script',
  title: 'Editar un guion de reel',
  description: 'Cambia el estado de un guion (pendiente, grabado, publicado, descartado) o corrige su texto (gancho, cierre, caption, tomas…).',
  inputSchema: z.object({
    id: z.string().min(1).max(100).describe('Id del guion (list_reel_scripts).'),
    estado: z.enum(ESTADOS_GUION).optional(),
    titulo: z.string().max(100).optional(),
    gancho: z.string().max(300).optional(),
    textoEnPantalla: z.string().max(80).optional(),
    cierre: z.string().max(300).optional(),
    caption: z.string().max(1500).optional(),
    musica: z.string().max(200).optional(),
    edicion: z.string().max(400).optional(),
    tomas: z.array(z.object({ decir: z.string().max(400), mostrar: z.string().max(200) })).min(1).max(8).optional(),
  }),
  annotations: { readOnlyHint: false, idempotentHint: true },
  async handler(args, { db }) {
    const { id, ...campos } = args;
    if (!(await db.collection(GUIONES).doc(id).get()).exists) throw new ToolError(`No existe el guion ${id}. Usá list_reel_scripts.`);
    try {
      const g = await actualizarGuion(db, id, campos);
      return { summary: `Guion "${g.titulo}" actualizado (${g.estado}).`, data: g };
    } catch (e) {
      throw new ToolError(e.message);
    }
  },
});

export const createContentPieceTool = defineTool({
  name: 'create_content_piece',
  title: 'Próxima pieza del bot de contenido',
  description:
    'Genera YA una pieza del bot de contenido sobre la idea que diga Mariano ("esta es la próxima pieza"): carrusel de '
    + 'placas + texto del post + página en /aprende. Por default queda como borrador para revisarla en el admin '
    + '(Bot de contenido → Últimas piezas). Con publicar: true sale en Facebook + Instagram (carrusel) y LinkedIn (PDF): '
    + 'confirmalo con Mariano antes. Con con_reel: true también se arma el reel automático de esa pieza. Tarda 1 a 3 '
    + 'minutos. Alternativa sin esperar: en_cola: true la deja como la próxima que sale en la corrida automática.',
  inputSchema: z.object({
    tema: z.string().min(5).max(500).describe('La idea de la pieza.'),
    serie_id: z.string().max(60).optional().describe('Serie del bot (default: la que toca). Ver series en el admin.'),
    con_reel: z.boolean().optional().describe('Armar también el reel (default false).'),
    publicar: z.boolean().optional().describe('Publicar en redes ya (default false = borrador).'),
    en_cola: z.boolean().optional().describe('No generar ahora: dejarla primera en la cola de la corrida automática.'),
  }),
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(args, { db, now }) {
    const config = await loadContenidoConfig(db);
    if (args.serie_id && !config.series.some(s => s.id === args.serie_id)) {
      throw new ToolError(`No existe la serie ${args.serie_id}. Series: ${config.series.map(s => `${s.id} (${s.nombre})`).join(', ')}`);
    }
    if (args.en_cola) {
      const idea = { id: `c${now.getTime().toString(36)}`, tema: args.tema, serieId: args.serie_id || null, conReel: args.con_reel === true };
      await db.collection('contenido_config').doc('settings').set({ cola: [idea, ...config.cola].slice(0, 20) }, { merge: true });
      return { summary: `Quedó primera en la cola: sale en la próxima corrida automática${config.activo ? '' : ' (ojo: el bot está apagado)'}.`, data: { cola: [idea, ...config.cola].slice(0, 20) } };
    }
    if (args.publicar) {
      const slot = await claimSocialSlot(db, now);
      if (!slot.ok) throw new ToolError(`Ya se usaron las ${slot.cap} publicaciones del día desde Claude. Generala como borrador.`);
    }
    const r = await runContenido({ force: true, serieId: args.serie_id || null, tema: args.tema, conReel: args.con_reel === true, publicar: args.publicar === true });
    if (r.skipped === 'en_curso') throw new ToolError('Ya se está generando otra pieza. Probá en unos minutos.');
    if (r.estado === 'error') throw new ToolError(`No salió la pieza: ${r.error}`);
    return {
      summary: `${r.estado === 'publicado' ? 'Publicada' : 'Borrador listo'}: "${r.titulo}" (${r.serie}).${r.reel ? ` ${r.reel}.` : ''}${r.error ? ` Ojo: ${r.error}` : ''}`,
      data: { id: r.id, titulo: r.titulo, serie: r.serie, estado: r.estado, imagenes: r.imagenes, reel: r.reel || null, redes: r.redes || null },
    };
  },
});

export const CONTENT_TOOLS = [generateReelScriptsTool, listReelScriptsTool, updateReelScriptTool, createContentPieceTool];
