import { z } from 'zod';
import { PROVINCIAS_AR } from '@/data/localidadesAR';
import { demandaReportUrl, fechaLarga, validateDemandaPatch, zonaId } from '@/lib/demandaReport';
import { loadDemandaConfig, runDemandaAuto, REPORTES } from '@/lib/demandaAutoRun';
import { defineTool, ToolError } from '../defineTool';
import { pageArray } from '../paginate';
import { claimSocialSlot } from '../socialCap';

// Informes de demanda (/demanda): qué rubros se buscan más en Google por zona. Lógica en
// src/lib/demandaReport.js y src/lib/demandaAutoRun.js (la misma que usa el cron y el admin).

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Nombre oficial de provincia y localidad (los que usa el admin), sin importar acentos ni mayúsculas.
export function resolverLocalidad({ provincia, localidad }) {
  const prov = PROVINCIAS_AR.find(p => norm(p.provincia) === norm(provincia));
  if (!prov) throw new ToolError(`Provincia desconocida: "${provincia}". Opciones: ${PROVINCIAS_AR.map(p => p.provincia).join(', ')}.`);
  const loc = prov.localidades.find(l => norm(l) === norm(localidad));
  if (loc) return { provincia: prov.provincia, localidad: loc };
  const parecidas = prov.localidades.filter(l => norm(l).includes(norm(localidad)) || norm(localidad).includes(norm(l))).slice(0, 8);
  throw new ToolError(`No encontré "${localidad}" en ${prov.provincia}.${parecidas.length ? ` ¿Quisiste decir: ${parecidas.join(', ')}?` : ''}`);
}

const resumen = (id, r) => ({
  id,
  zona: r.zona,
  localidades: r.localidades || [],
  fecha: r.createdAtMs ? fechaLarga(r.createdAtMs) : null,
  top3: (r.top || []).slice(0, 3).map(t => t.label),
  url: demandaReportUrl(id),
  publicado: r.postEstado || null,
});

export const listDemandReportsTool = defineTool({
  name: 'list_demand_reports',
  title: 'Informes de demanda',
  description:
    'Informes publicados en marianoaliandri.com.ar/demanda: qué rubros se buscan más en Google en cada zona, del más '
    + 'nuevo al más viejo, con el podio y si se publicó en redes. Incluye las zonas configuradas y si la publicación '
    + 'automática (mar–vie 18 h: PDF en LinkedIn + carrusel en Facebook e Instagram) está prendida.',
  inputSchema: z.object({
    zona: z.string().max(80).optional().describe('Filtrar por nombre de zona (ej. "Alto Valle").'),
    cursor: z.string().optional().describe('nextCursor de la llamada anterior.'),
    limit: z.number().int().min(1).max(50).optional().describe('Cuántos (default 20, máx 50).'),
  }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const [snap, config] = await Promise.all([
      db.collection(REPORTES).orderBy('createdAtMs', 'desc').limit(200).get(),
      loadDemandaConfig(db),
    ]);
    let lista = snap.docs.map(d => resumen(d.id, d.data()));
    if (args.zona) lista = lista.filter(r => norm(r.zona) === norm(args.zona) || zonaId(r.zona) === zonaId(args.zona));
    const page = pageArray(lista, { cursor: args.cursor, limit: args.limit ?? 20 });
    const zonas = config.zonas.map(z => ({
      id: z.id, nombre: z.nombre, localidades: z.localidades.map(l => `${l.localidad} (${l.provincia})`),
      ultimaVez: config.ultimaCorrida[z.id] ? fechaLarga(config.ultimaCorrida[z.id]) : null,
    }));
    return {
      summary: `${page.total} informes. Publicación automática ${config.activo ? 'prendida' : 'apagada'}; ${zonas.length} zonas.`,
      data: { ...page, automatico: config.activo, zonas },
    };
  },
});

export const getDemandReportTool = defineTool({
  name: 'get_demand_report',
  title: 'Ver un informe de demanda',
  description:
    'Un informe de demanda completo: los 20 rubros más buscados de la zona con su índice (el primero = 100), cuánto '
    + 'subió o bajó cada uno respecto del informe anterior, el índice en cada localidad y las frases reales que '
    + 'escribe la gente. Es un índice para ordenar rubros (autocompletado de Google), no cantidad de búsquedas.',
  inputSchema: z.object({ id: z.string().min(1).max(100).describe('Id del informe.') }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const snap = await db.collection(REPORTES).doc(args.id).get();
    if (!snap.exists) throw new ToolError(`No existe el informe ${args.id}. Usá list_demand_reports.`);
    const r = snap.data();
    return {
      summary: `${r.zona}, ${fechaLarga(r.createdAtMs)}: ${(r.top || []).slice(0, 3).map(t => t.label).join(', ')}…`,
      data: {
        ...resumen(snap.id, r),
        rubros: (r.top || []).map(t => ({
          pos: t.pos, rubro: t.label, indice: t.interes, cambio: t.cambio ?? null, nuevo: !!t.nuevo,
          frases: t.ejemplos || [], porLocalidad: t.porLocalidad || [],
        })),
      },
    };
  },
});

export const runDemandReportTool = defineTool({
  name: 'run_demand_report',
  title: 'Armar un informe de demanda',
  description:
    'Arma ahora el informe de demanda de una zona (o de la que toca) y lo publica en marianoaliandri.com.ar/demanda. '
    + 'Siempre saca las capturas del informe que van en el carrusel y en el PDF (devuelve sus URLs en placas: mostráselas a Mariano). Con publicar: false '
    + '(default) NO postea en redes. Con publicar: true además lo publica DE VERDAD como PDF en LinkedIn y carrusel en '
    + 'Facebook + Instagram (confirmalo con Mariano). Tarda unos segundos por localidad. Es gratis (no '
    + 'usa Google Places). Una zona que salió en los últimos 6 días solo se arma si se la pide por nombre.',
  inputSchema: z.object({
    zona: z.string().max(80).optional().describe('Nombre o id de la zona (ver list_demand_reports). Sin zona: la que toca.'),
    publicar: z.boolean().optional().describe('true = también postea en LinkedIn e Instagram (default false).'),
  }),
  annotations: { readOnlyHint: false, openWorldHint: true },
  async handler(args, { db }) {
    let zonaIdElegida = null;
    if (args.zona) {
      const config = await loadDemandaConfig(db);
      const z = config.zonas.find(x => x.id === args.zona || norm(x.nombre) === norm(args.zona) || x.id === zonaId(args.zona));
      if (!z) throw new ToolError(`No hay una zona "${args.zona}". Zonas: ${config.zonas.map(x => x.nombre).join(', ')}. Creala con save_demand_zone.`);
      zonaIdElegida = z.id;
    }
    if (args.publicar) {
      const slot = await claimSocialSlot(db);
      if (!slot.ok) throw new ToolError(`Ya se hicieron ${slot.cap} publicaciones desde el MCP hoy (tope MCP_SOCIAL_DAILY_CAP). Armalo con publicar: false.`);
    }
    const run = await runDemandaAuto({ force: true, zonaId: zonaIdElegida, publicar: !!args.publicar });
    if (run.skipped) {
      const motivos = { sin_zonas: 'todas las zonas salieron en los últimos 6 días (pedí una por nombre)', en_curso: 'hay otra corrida en marcha', zona_inexistente: 'la zona no existe' };
      throw new ToolError(`No se armó: ${motivos[run.skipped] || run.skipped}.`);
    }
    const data = { estado: run.estado, zona: run.zona, rubrosConDatos: run.rubrosConDatos ?? null, placas: run.placas || [], redes: run.redes || null, error: run.error || null };
    if (run.reporteId) Object.assign(data, { id: run.reporteId, url: demandaReportUrl(run.reporteId) });
    const txt = {
      ok: 'informe publicado: PDF en LinkedIn y carrusel en Facebook + Instagram',
      guardado: 'informe publicado en el sitio (sin postear en redes)',
      sin_datos: 'Google devolvió pocos datos, no se publicó nada',
      post_fallido: 'el informe quedó en el sitio pero el post a redes falló',
      error: 'falló la corrida',
    }[run.estado] || run.estado;
    return { summary: `${run.zona}: ${txt}.${data.url ? ` ${data.url}` : ''}`, data };
  },
});

export const saveDemandZoneTool = defineTool({
  name: 'save_demand_zone',
  title: 'Crear o cambiar una zona de demanda',
  description:
    'Crea una zona para los informes de demanda o reemplaza las localidades de una existente (mismo nombre). Una '
    + 'zona puede ser una ciudad o un grupo de localidades que salen juntas en un informe (ej. "Alto Valle" = '
    + 'Neuquén, Plottier, Cipolletti…). Los nombres se validan contra el listado oficial de localidades (sin importar '
    + 'acentos). Con eliminar: true borra la zona. Sale sola en el próximo turno libre (mar–vie 18 h) si la '
    + 'publicación automática está prendida.',
  inputSchema: z.object({
    nombre: z.string().min(1).max(60).describe('Nombre de la zona, tal cual se muestra (ej. "Comarca Andina").'),
    localidades: z.array(z.object({
      provincia: z.string().min(1).max(60).describe('Provincia (ej. "Río Negro").'),
      localidad: z.string().min(1).max(80).describe('Localidad (ej. "Cipolletti").'),
    })).max(15).optional().describe('1 a 15 localidades. Obligatorio salvo para eliminar.'),
    eliminar: z.boolean().optional().describe('true = borra la zona.'),
  }),
  annotations: { readOnlyHint: false },
  async handler(args, { db }) {
    const config = await loadDemandaConfig(db);
    const id = zonaId(args.nombre);
    const existe = config.zonas.some(z => z.id === id);
    let zonas;
    if (args.eliminar) {
      if (!existe) throw new ToolError(`No hay una zona "${args.nombre}".`);
      zonas = config.zonas.filter(z => z.id !== id);
      if (!zonas.length) throw new ToolError('Tiene que quedar al menos una zona.');
    } else {
      if (!args.localidades?.length) throw new ToolError('Pasá al menos una localidad.');
      const zona = { nombre: args.nombre.trim(), localidades: args.localidades.map(resolverLocalidad) };
      zonas = existe ? config.zonas.map(z => (z.id === id ? zona : z)) : [...config.zonas, zona];
    }
    const { update, error } = validateDemandaPatch({ zonas: zonas.map(({ nombre, localidades }) => ({ nombre, localidades })) });
    if (error) throw new ToolError(error);
    await db.collection('demanda_auto').doc('config').set(update, { merge: true });
    const z = update.zonas.find(x => x.id === id);
    return {
      summary: args.eliminar ? `Zona ${args.nombre} eliminada.` : `Zona ${z.nombre} ${existe ? 'actualizada' : 'creada'}: ${z.localidades.map(l => l.localidad).join(', ')}.`,
      data: { zonas: update.zonas.map(x => ({ id: x.id, nombre: x.nombre, localidades: x.localidades })) },
    };
  },
});

export const DEMAND_TOOLS = [listDemandReportsTool, getDemandReportTool, runDemandReportTool, saveDemandZoneTool];
