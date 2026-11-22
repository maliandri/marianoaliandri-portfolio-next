import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { defineTool, ToolError } from '../defineTool';
import { pageArray } from '../paginate';
import {
  ESTADOS, CATEGORIAS, PRIORIDADES,
  agruparFaltantes, herramientasQueFallan, herramientasSinUso, ideasPendientes,
} from '@/lib/aprendizaje';

// Autoaprendizaje del conector: faltantes (lo que Mariano pide y no se puede), ideas sueltas y un
// resumen de uso para decidir qué desarrollar. Escriben solo en mcp_gaps / mcp_ideas (Admin SDK).
const COL = { faltante: 'mcp_gaps', idea: 'mcp_ideas' };
const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_LECTURA = 1000;
const MAX_LLAMADAS = 5000;
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
const texto = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null; };
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

async function leer(db, coleccion) {
  const snap = await db.collection(coleccion).orderBy('creadoMs', 'desc').limit(MAX_LECTURA).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export const registrarFaltanteTool = defineTool({
  name: 'registrar_faltante',
  title: 'Registrar algo que el conector no puede hacer',
  description:
    'Anotá un pedido de Mariano que este conector no puede resolver: no hay ninguna herramienta para eso, o la que hay '
    + 'no alcanza. Usala apenas te des cuenta de que no podés cumplir lo que te pidió, y contale que quedó anotado para '
    + 'desarrollarlo. Poné el pedido con sus palabras y, si se te ocurre, el nombre de la herramienta que haría falta '
    + '(en snake_case, ej. send_whatsapp). No la uses para un error pasajero de una herramienta que sí existe. '
    + 'Solo guarda en la base del sitio: no tiene efectos afuera.',
  inputSchema: z.object({
    pedido: z.string().min(3).max(1000).describe('Lo que pidió Mariano, con sus palabras.'),
    herramienta_sugerida: z.string().max(200).optional().describe('Herramienta que haría falta, ej. send_whatsapp. Opcional.'),
    contexto: z.string().max(1000).optional().describe('Por qué no se pudo o qué se intentó. Opcional.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args, { db, now = new Date() }) {
    const pedido = texto(args.pedido, 1000);
    if (!pedido) throw new ToolError('Falta el pedido.');
    const ms = now.getTime();
    const ref = await db.collection(COL.faltante).add({
      pedido,
      herramientaSugerida: texto(args.herramienta_sugerida, 200),
      contexto: texto(args.contexto, 1000),
      estado: 'nuevo', nota: null,
      creadoMs: ms, actualizadoMs: ms,
      creadoAt: FieldValue.serverTimestamp(), actualizadoAt: FieldValue.serverTimestamp(),
    });
    return { summary: `Quedó anotado como faltante (${ref.id}), en estado "nuevo".`, data: { id: ref.id, estado: 'nuevo' } };
  },
});

export const guardarIdeaTool = defineTool({
  name: 'guardar_idea',
  title: 'Guardar una idea',
  description:
    'Guardá una idea suelta que Mariano te dicta, por ejemplo mientras camina: una herramienta nueva, una mejora, algo '
    + 'del negocio o un tema para contenido. Respetá sus palabras (podés ordenar la redacción, sin agregar cosas). '
    + 'Si no dice la categoría o la prioridad, dejalas vacías: no las inventes. Solo guarda en la base del sitio.',
  inputSchema: z.object({
    idea: z.string().min(1).max(2000).describe('La idea, con las palabras de Mariano.'),
    categoria: z.enum(CATEGORIAS).optional().describe('herramienta, mejora, negocio o contenido. Opcional.'),
    prioridad: z.enum(PRIORIDADES).optional().describe('alta, media o baja. Opcional.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  async handler(args, { db, now = new Date() }) {
    const idea = texto(args.idea, 2000);
    if (!idea) throw new ToolError('Falta la idea.');
    if (args.categoria && !CATEGORIAS.includes(args.categoria)) throw new ToolError(`Categoría inválida: usá ${CATEGORIAS.join(', ')}.`);
    if (args.prioridad && !PRIORIDADES.includes(args.prioridad)) throw new ToolError(`Prioridad inválida: usá ${PRIORIDADES.join(', ')}.`);
    const ms = now.getTime();
    const ref = await db.collection(COL.idea).add({
      idea, categoria: args.categoria || null, prioridad: args.prioridad || null,
      estado: 'nuevo', nota: null,
      creadoMs: ms, actualizadoMs: ms,
      creadoAt: FieldValue.serverTimestamp(), actualizadoAt: FieldValue.serverTimestamp(),
    });
    return { summary: `Idea guardada (${ref.id}).`, data: { id: ref.id, estado: 'nuevo' } };
  },
});

const aItem = (tipo, d) => ({
  tipo, id: d.id,
  texto: tipo === 'idea' ? d.idea : d.pedido,
  categoria: d.categoria ?? null, prioridad: d.prioridad ?? null,
  herramientaSugerida: d.herramientaSugerida ?? null,
  estado: d.estado, nota: d.nota ?? null,
  creado: iso(d.creadoMs), actualizado: iso(d.actualizadoMs),
  creadoMs: d.creadoMs || 0,
});

export const listarIdeasTool = defineTool({
  name: 'listar_ideas',
  title: 'Listar ideas y faltantes',
  description:
    'Lista las ideas guardadas y los faltantes registrados (lo que el conector no pudo hacer), de lo más nuevo a lo más '
    + 'viejo. Filtrá por tipo, estado (nuevo, en_desarrollo, hecho, descartado), categoría (solo ideas) o antigüedad en '
    + 'días. Devuelve el id de cada uno, que sirve para actualizar_estado. Solo lee.',
  inputSchema: z.object({
    tipo: z.enum(['ideas', 'faltantes', 'todos']).optional().describe('Qué listar (default: todos).'),
    estado: z.enum(ESTADOS).optional().describe('Filtrar por estado.'),
    categoria: z.enum(CATEGORIAS).optional().describe('Filtrar ideas por categoría.'),
    desde_dias: z.number().int().min(1).max(365).optional().describe('Solo lo creado en los últimos N días.'),
    cursor: z.string().optional().describe('nextCursor de la llamada anterior.'),
    limit: z.number().int().min(1).max(50).optional().describe('Cuántos devolver (default 20).'),
  }),
  annotations: { readOnlyHint: true, openWorldHint: false },
  async handler(args, { db, now = new Date() }) {
    const tipo = args.tipo || 'todos';
    const [ideas, faltantes] = await Promise.all([
      tipo === 'faltantes' ? [] : leer(db, COL.idea),
      tipo === 'ideas' ? [] : leer(db, COL.faltante),
    ]);
    const desde = args.desde_dias ? now.getTime() - args.desde_dias * DIA_MS : 0;
    const lista = [...ideas.map(d => aItem('idea', d)), ...faltantes.map(d => aItem('faltante', d))]
      .filter(x => (!args.estado || x.estado === args.estado)
        && (!args.categoria || x.categoria === args.categoria)
        && x.creadoMs >= desde)
      .sort((a, b) => b.creadoMs - a.creadoMs)
      .map(({ creadoMs, ...x }) => x);
    const page = pageArray(lista, { cursor: args.cursor, limit: args.limit ?? 20 });
    return { summary: `${page.total} encontrados, devuelvo ${page.items.length}.`, data: page };
  },
});

export const actualizarEstadoTool = defineTool({
  name: 'actualizar_estado',
  title: 'Cambiar el estado de una idea o un faltante',
  description:
    'Cambia el estado de una idea o de un faltante: nuevo, en_desarrollo, hecho o descartado. Usá el id que devuelve '
    + 'listar_ideas. Podés agregar una nota corta con el motivo (ej. "ya está la tool send_whatsapp"). '
    + 'Solo modifica la base del sitio.',
  inputSchema: z.object({
    tipo: z.enum(['idea', 'faltante']).describe('Si es una idea o un faltante.'),
    id: z.string().min(1).max(100).describe('Id que devolvió listar_ideas.'),
    estado: z.enum(ESTADOS).describe('Estado nuevo.'),
    nota: z.string().max(500).optional().describe('Motivo del cambio. Opcional.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  async handler(args, { db, now = new Date() }) {
    const col = COL[args.tipo];
    if (!col) throw new ToolError('tipo tiene que ser "idea" o "faltante".');
    if (!ESTADOS.includes(args.estado)) throw new ToolError(`Estado inválido: usá ${ESTADOS.join(', ')}.`);
    if (!ID_RE.test(String(args.id || ''))) throw new ToolError('Id inválido: usá el que devolvió listar_ideas.');
    const ref = db.collection(col).doc(args.id);
    const snap = await ref.get();
    if (!snap.exists) throw new ToolError(`No existe ${args.tipo === 'idea' ? 'una idea' : 'un faltante'} con id ${args.id}. Usá listar_ideas para ver los ids.`);
    const prev = snap.data();
    const nota = texto(args.nota, 500);
    await ref.update({
      estado: args.estado,
      ...(nota ? { nota } : {}),
      actualizadoMs: now.getTime(),
      actualizadoAt: FieldValue.serverTimestamp(),
    });
    const que = String((args.tipo === 'idea' ? prev.idea : prev.pedido) || '').slice(0, 80);
    return {
      summary: `"${que}" pasó de ${prev.estado} a ${args.estado}.`,
      data: { tipo: args.tipo, id: args.id, estadoAnterior: prev.estado, estado: args.estado },
    };
  },
});

export const resumenAprendizajeTool = defineTool({
  name: 'resumen_aprendizaje',
  title: 'Qué falta desarrollar',
  description:
    'Resumen para decidir qué desarrollar en el conector, de los últimos 7 o 28 días: lo que Mariano más pidió sin '
    + 'poder hacerlo (faltantes abiertos agrupados), las herramientas que fallan seguido (tasa de error, con al menos '
    + '3 llamadas), las que no se usaron en el período y las ideas pendientes ordenadas por prioridad (todas las '
    + 'abiertas, sin importar la fecha). Solo lee.',
  inputSchema: z.object({
    dias: z.union([z.literal(7), z.literal(28)]).optional().describe('Período: 7 o 28 días (default 28).'),
  }),
  annotations: { readOnlyHint: true, openWorldHint: false },
  async handler(args, { db, now = new Date(), toolNames = [] }) {
    const dias = args.dias === 7 ? 7 : 28;
    const desde = now.getTime() - dias * DIA_MS;
    const [gaps, ideas, callsSnap] = await Promise.all([
      leer(db, COL.faltante),
      leer(db, COL.idea),
      db.collection('mcp_tool_calls').where('at', '>=', new Date(desde)).orderBy('at', 'desc').limit(MAX_LLAMADAS).get(),
    ]);
    const calls = callsSnap.docs.map(d => {
      const c = d.data();
      return { tool: c.tool, ok: c.ok, error: c.error || null, tipoError: c.tipoError || null, atMs: c.at?.toMillis?.() ?? 0 };
    });
    const gapsPeriodo = gaps.filter(g => (g.creadoMs || 0) >= desde);

    const faltantes = agruparFaltantes(gapsPeriodo);
    const fallan = herramientasQueFallan(calls);
    const sinUso = herramientasSinUso(toolNames, calls);
    const pendientes = ideasPendientes(ideas);
    const data = {
      dias,
      totales: {
        llamadas: calls.length,
        errores: calls.filter(c => !c.ok).length,
        faltantesNuevos: gapsPeriodo.length,
        ideasNuevas: ideas.filter(i => (i.creadoMs || 0) >= desde).length,
      },
      faltantesMasPedidos: faltantes,
      herramientasQueFallan: fallan,
      herramientasSinUso: sinUso,
      ideasPendientes: pendientes,
      ...(calls.length >= MAX_LLAMADAS ? { aviso: `Se leyeron solo las últimas ${MAX_LLAMADAS} llamadas del período.` } : {}),
    };
    const top = faltantes[0];
    return {
      summary: `Últimos ${dias} días: ${gapsPeriodo.length} faltantes`
        + `${top ? ` (lo más pedido: ${top.herramienta || top.ejemplo}, ${top.veces} ${top.veces === 1 ? 'vez' : 'veces'})` : ''}, `
        + `${fallan.length} herramientas con errores, ${sinUso.length} sin uso y ${pendientes.length} ideas pendientes.`,
      data,
    };
  },
});

export const LEARNING_TOOLS = [registrarFaltanteTool, guardarIdeaTool, listarIdeasTool, actualizarEstadoTool, resumenAprendizajeTool];
