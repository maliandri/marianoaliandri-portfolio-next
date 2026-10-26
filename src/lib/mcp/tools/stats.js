import { z } from 'zod';
import { PLACES_LIMITS } from '@/data/placesFreeTier';
import { buildUsageReport } from '@/lib/placesUsage';
import { fetchGA4, fetchGSC } from '@/lib/siteStats';
import { defineTool, ToolError } from '../defineTool';
import { placesBudget } from '../placesBudget';

export const getPlacesUsageTool = defineTool({
  name: 'get_places_usage',
  title: 'Consumo de Google Places',
  description:
    'Cuánto se usó en el mes de Google Places (lo que cuesta plata en Lead Finder): comercios auditados y búsquedas '
    + 'por día, cupo gratis restante, proyección a fin de mes y costo estimado en USD. Incluye cuánto usó hoy el MCP '
    + 'contra su tope diario.',
  inputSchema: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Mes YYYY-MM (default: el actual).'),
  }),
  annotations: { readOnlyHint: true },
  async handler(args, { db, now = new Date() }) {
    const today = now.toISOString().slice(0, 10);
    const month = args.month || today.slice(0, 7);
    const snap = await db.collection('leadfinder_usage')
      .where('__name__', '>=', `${month}-01`)
      .where('__name__', '<=', `${month}-31`)
      .get();
    const rows = snap.docs.map(d => {
      const { getPlaceRequests = 0, searchTextRequests = 0, searchNearbyRequests = 0 } = d.data();
      return { id: d.id, getPlaceRequests, searchTextRequests, searchNearbyRequests };
    });
    const report = buildUsageReport(rows, { month, today, limits: PLACES_LIMITS });
    const budget = await placesBudget(db, { now });
    return {
      summary: `${month}: ${report.totals.details} comercios auditados, quedan ${report.restantes} del cupo gratis; costo estimado USD ${report.costoEstimadoUSD}. MCP hoy: ${budget.usedToday}/${budget.dailyCap}.`,
      data: { month, ...report, mcpHoy: budget.usedToday, mcpTopeDiario: budget.dailyCap, mesPctCupo: budget.monthPct },
    };
  },
});

export const getSiteStatsTool = defineTool({
  name: 'get_site_stats',
  title: 'Estadísticas del sitio',
  description:
    'Visitas de marianoaliandri.com.ar (Google Analytics, sin bots) y búsquedas en Google (Search Console) de los '
    + 'últimos 7, 28 o 90 días: sesiones, usuarios, páginas más vistas, de dónde llegan, ciudades, clics e impresiones.',
  inputSchema: z.object({
    days: z.union([z.literal(7), z.literal(28), z.literal(90)]).optional().describe('Período en días: 7, 28 o 90 (default 28).'),
  }),
  annotations: { readOnlyHint: true },
  async handler(args) {
    const days = args.days ?? 28;
    const [ga, gsc] = await Promise.allSettled([fetchGA4({ days }), fetchGSC({ days })]);
    if (ga.status === 'rejected' && gsc.status === 'rejected') throw new ToolError('No se pudieron leer las estadísticas (GA4 y Search Console fallaron).');
    const g = ga.status === 'fulfilled' ? ga.value : null;
    const s = gsc.status === 'fulfilled' ? gsc.value : null;
    const data = {
      dias: days,
      analytics: g && !g.noData ? {
        sesiones: g.sesiones, usuarios: g.usuarios, paginasVistas: g.paginasVistas, bots: g.bots,
        paginas: g.paginas, fuentes: g.fuentes, ciudades: g.ciudades,
      } : null,
      searchConsole: s ? { clics: s.clicks, impresiones: s.impresiones, posicion: s.posicion } : null,
    };
    const partes = [];
    if (data.analytics) partes.push(`${data.analytics.usuarios} usuarios y ${data.analytics.sesiones} sesiones`);
    if (data.searchConsole) partes.push(`${data.searchConsole.clics} clics y ${data.searchConsole.impresiones} impresiones en Google`);
    return { summary: `Últimos ${days} días: ${partes.join('; ') || 'sin datos'}.`, data };
  },
});

export const STATS_TOOLS = [getPlacesUsageTool, getSiteStatsTool];
