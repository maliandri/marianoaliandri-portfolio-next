import { z } from 'zod';
import { after } from 'next/server';
import { RUBROS } from '@/data/rubros';
import { makeLeadFinderCall } from '@/lib/leadFinderPro';
import { getSearch, listSearches } from '@/lib/leadSearchesStore';
import { analyzeAll, rankAnalyzed, oportunidad } from '@/lib/rubroDemand';
import { defineTool, ToolError } from '../defineTool';
import { pageArray } from '../paginate';
import { placesBudget } from '../placesBudget';
import { createLeadJob, getLeadJob, runLeadJob } from '../leadJobs';

const RUBRO_IDS = new Set(RUBROS.map(r => r.id));
const STALE_MS = 15 * 60000;
const limitSchema = z.number().int().min(1).max(50).optional().describe('Cuántos ítems por página (default 20, máx 50).');
const cursorSchema = z.string().optional().describe('nextCursor de la llamada anterior, para seguir paginando.');

// Campos de un lead que ve Claude (nada de datos internos del caché).
export function leadOut(l) {
  return {
    placeId: l.id, nombre: l.nombre, ciudad: l.ciudad, rubro: l.tipo,
    canal: l.canal || null, web: l.siteUrl || null, seoScore: l.seoScore ?? null,
    email: l.email || null, telefono: l.phone || null, whatsapp: l.whatsapp || null,
    instagram: l.instagram || null, rating: l.rating ?? l.previewRating ?? null,
    demanda: l.demanda ? { interes: l.demanda.interes, ejemplos: (l.demanda.ejemplos || []).slice(0, 3) } : null,
    oportunidad: oportunidad(l),
    ...(l.prodState === 'done' ? { productos: l.prodCount } : {}),
  };
}

const porOportunidad = (leads) => [...leads].sort((a, b) => oportunidad(b) - oportunidad(a));

export const searchLeadsTool = defineTool({
  name: 'search_leads',
  title: 'Buscar leads',
  description:
    'Busca negocios en Google Maps por rubro y/o término en una o varias localidades de Argentina, audita su web '
    + '(puntaje SEO, email, Instagram) y se queda solo con los leads: con web, o sin web pero con WhatsApp. '
    + 'CUESTA PLATA (Google Places): usar cantidades chicas salvo que Mariano pida más. Es asíncrona: devuelve un '
    + 'jobId enseguida; después llamá a get_lead_search con ese jobId cada ~15 segundos hasta que status sea "done". '
    + 'Para elegir rubros, rank_rubros_by_demand devuelve los ids válidos y cuáles se buscan más.',
  inputSchema: z.object({
    localidades: z.array(z.string().min(2).max(120)).min(1).max(5)
      .describe('Localidades como "Ciudad, Provincia" (ej. "Cipolletti, Río Negro"). Se asume Argentina.'),
    rubros: z.array(z.string().max(60)).max(10).optional()
      .describe('Ids de rubros de Google Maps (ej. los que devuelve rank_rubros_by_demand).'),
    terminos: z.array(z.string().min(2).max(60)).max(10).optional()
      .describe('Términos libres de búsqueda (ej. "durlock", "fábrica de aberturas").'),
    cantidad: z.number().int().min(1).max(30).describe('Cuántos leads entregar (se revisan hasta 3 veces más negocios).'),
    radio_km: z.number().int().min(1).max(50).optional().describe('Radio de búsqueda en km (default 10).'),
    perfil: z.enum(['dev', 'empresa']).optional().describe('"empresa" además cuenta productos en cada web (requiere producto).'),
    producto: z.string().max(60).optional().describe('Palabra del producto a contar en cada web (solo con perfil "empresa").'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  async handler(args, { db, user }) {
    const rubros = args.rubros || [];
    const terminos = args.terminos || [];
    if (!rubros.length && !terminos.length) throw new ToolError('Pasá al menos un rubro o un término de búsqueda.');
    const malos = rubros.filter(id => !RUBRO_IDS.has(id));
    if (malos.length) throw new ToolError(`Rubros desconocidos: ${malos.join(', ')}. Usá los ids de rank_rubros_by_demand o pasalos como terminos.`);
    if (args.perfil === 'empresa' && !args.producto) throw new ToolError('Con perfil "empresa" hace falta producto.');

    const budget = await placesBudget(db);
    if (!budget.ok) {
      throw new ToolError(budget.reason === 'diario'
        ? `Se terminó el cupo diario de Google Places del MCP (${budget.usedToday}/${budget.dailyCap}). Se renueva mañana.`
        : `El mes ya usó el ${budget.monthPct}% del cupo gratis de Google Places; no se busca más para no pagar.`);
    }

    const params = { ...args, rubros, terminos };
    const jobId = await createLeadJob(db, user.uid, params);
    after(() => runLeadJob(db, user, jobId, params, { call: makeLeadFinderCall(user) }));
    return {
      summary: `Búsqueda lanzada (jobId ${jobId}). Llamá a get_lead_search con job_id "${jobId}" en ~15 segundos.`,
      data: { jobId, status: 'running' },
    };
  },
});

export const getLeadSearchTool = defineTool({
  name: 'get_lead_search',
  title: 'Ver búsqueda de leads',
  description:
    'Estado y resultados de una búsqueda: pasá job_id (de search_leads) o search_id (del historial, ver '
    + 'list_lead_searches). Mientras status sea "running", volvé a llamarla en ~15 segundos. Los leads vienen '
    + 'ordenados por oportunidad (mucha demanda del rubro y web floja primero) y paginados.',
  inputSchema: z.object({
    job_id: z.string().max(60).optional().describe('jobId devuelto por search_leads.'),
    search_id: z.string().max(60).optional().describe('Id de una búsqueda guardada del historial.'),
    cursor: cursorSchema,
    limit: limitSchema,
  }),
  annotations: { readOnlyHint: true },
  async handler(args, { db, user }) {
    if (!args.job_id && !args.search_id) throw new ToolError('Pasá job_id o search_id.');
    let base;
    if (args.job_id) {
      const job = await getLeadJob(db, user.uid, args.job_id);
      if (!job) throw new ToolError('No existe esa búsqueda (job_id).');
      base = { status: job.status, error: job.error || null, totales: job.totals, avisos: job.avisos || [], searchId: job.searchId || null, leads: job.leads || [] };
      // Si la función se cortó (timeout, caída), el job queda "running" para siempre: después de
      // STALE_MS sin novedades se informa como cortado, con lo que alcanzó a encontrar.
      const last = job.updatedAt?.toDate?.()?.getTime?.() || 0;
      if (job.status === 'running' && Date.now() - last > STALE_MS) {
        base = { ...base, status: 'error', error: 'La búsqueda se cortó sin terminar; abajo va lo que alcanzó a encontrar. Podés relanzarla.' };
      }
    } else {
      const s = await getSearch(db, user.uid, args.search_id);
      if (!s) throw new ToolError('No existe esa búsqueda (search_id).');
      base = { status: 'done', error: null, totales: s.stats, avisos: [], searchId: s.id, leads: s.results || [] };
    }
    const { leads, ...rest } = base;
    const page = pageArray(porOportunidad(leads), { cursor: args.cursor, limit: args.limit ?? 20 });
    const data = { ...rest, items: page.items.map(leadOut), nextCursor: page.nextCursor, totalLeads: page.total };
    const t = rest.totales || {};
    const summary = rest.status === 'running'
      ? `Sigue buscando: ${t.leads || 0} leads de ${t.examinados || 0} negocios revisados. Volvé a consultar en ~15 s.`
      : rest.status === 'error'
        ? `La búsqueda falló: ${rest.error}`
        : `Listo: ${page.total} leads (${t.conWeb || 0} con web, ${t.descartados || 0} descartados).${rest.avisos.length ? ` Avisos: ${rest.avisos.slice(0, 3).join(' | ')}` : ''}`;
    return { summary, data };
  },
});

export const listLeadSearchesTool = defineTool({
  name: 'list_lead_searches',
  title: 'Historial de búsquedas',
  description: 'Historial de búsquedas de leads de Mariano (panel admin y MCP), más nuevas primero, paginado. Para ver los leads de una, usá get_lead_search con su search_id.',
  inputSchema: z.object({ cursor: cursorSchema, limit: limitSchema }),
  annotations: { readOnlyHint: true },
  async handler(args, { db, user }) {
    const r = await listSearches(db, user.uid, { limit: args.limit ?? 20, cursor: args.cursor || null });
    const items = r.items.map(s => ({
      searchId: s.id, fecha: s.createdAt, ciudades: s.ciudades, rubros: s.tipos, terminos: s.terminos,
      leads: s.resultCount, origen: s.via === 'mcp' ? 'mcp' : s.origen, stats: s.stats,
    }));
    return { summary: `${items.length} búsquedas${r.nextCursor ? ' (hay más)' : ''}.`, data: { items, nextCursor: r.nextCursor } };
  },
});

export const rankRubrosTool = defineTool({
  name: 'rank_rubros_by_demand',
  title: 'Rubros más buscados',
  description:
    'Rankea los rubros por cuánto los busca la gente en Google en una localidad (autocompletado de Google, gratis, '
    + 'no usa Places). Devuelve el id de cada rubro (sirve para search_leads), un puntaje de interés 0-100 y frases reales.',
  inputSchema: z.object({
    localidad: z.string().min(2).max(120).describe('Localidad, ej. "Neuquén" o "Cipolletti, Río Negro".'),
    top: z.number().int().min(1).max(50).optional().describe('Cuántos rubros devolver (default 20).'),
  }),
  annotations: { readOnlyHint: true, openWorldHint: true },
  async handler(args) {
    const ranked = rankAnalyzed(await analyzeAll(args.localidad, RUBROS));
    const items = ranked.filter(r => r.count > 0).slice(0, args.top ?? 20).map(r => ({
      rubroId: r.id, rubro: r.label, interes: r.interes, ejemplos: (r.suggestions || []).slice(0, 3),
    }));
    return {
      summary: items.length
        ? `Más buscados en ${args.localidad}: ${items.slice(0, 5).map(i => `${i.rubro} (${i.interes})`).join(', ')}.`
        : `No hay datos de búsqueda para ${args.localidad}.`,
      data: { localidad: args.localidad, items },
    };
  },
});

export const LEAD_TOOLS = [searchLeadsTool, getLeadSearchTool, listLeadSearchesTool, rankRubrosTool];
