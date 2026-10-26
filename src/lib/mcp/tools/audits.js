import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { buildAuditReportDraft, MIN_SITIOS_INFORME } from '@/lib/auditReportDraft';
import { saveAuditoria } from '@/lib/auditoriasStore';
import { imageIsReachable } from '@/lib/imageCheck';
import { postToMakeSocial } from '@/lib/makeSocial';
import { buildAuditPublishPayload, auditReportUrl, auditScreenshotUrl } from '@/lib/socialAuditPost';
import { getSearch } from '@/lib/leadSearchesStore';
import { tipoParams } from '@/lib/leadDemand';
import { ciudadDe } from '@/lib/rubroDemand';
import { problemasSeo } from '@/lib/bizEmail';
import { defineTool, ToolError } from '../defineTool';
import { decodeCursor, encodeCursor, pageArray } from '../paginate';
import { getLeadJob } from '../leadJobs';

const COL = 'auditorias';
const NETWORKS = ['linkedin', 'instagram', 'facebook'];
const limitSchema = z.number().int().min(1).max(50).optional().describe('Cuántos ítems por página (default 20, máx 50).');
const cursorSchema = z.string().optional().describe('nextCursor de la llamada anterior, para seguir paginando.');
const toIso = (t) => t?.toDate?.()?.toISOString() || null;

async function loadAudit(db, id) {
  if (typeof id !== 'string' || !id || id.includes('/')) throw new ToolError('Id de auditoría inválido.');
  const snap = await db.collection(COL).doc(id).get();
  if (!snap.exists) throw new ToolError('No existe esa auditoría.');
  return { id: snap.id, ref: snap.ref, ...snap.data() };
}

export const listAuditsTool = defineTool({
  name: 'list_audits',
  title: 'Auditorías publicadas',
  description: 'Informes SEO publicados en marianoaliandri.com.ar/auditorias, más nuevos primero, paginado.',
  inputSchema: z.object({ cursor: cursorSchema, limit: limitSchema }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const limit = args.limit ?? 20;
    let q = db.collection(COL).orderBy('publishedAt', 'desc');
    const c = decodeCursor(args.cursor);
    if (c?.p) q = q.startAfter(new Date(c.p));
    const snap = await q.limit(limit + 1).get();
    const items = snap.docs.slice(0, limit).map(d => {
      const x = d.data();
      return {
        id: d.id, titulo: x.title, ciudades: x.config?.ciudades || [], rubros: x.config?.tiposLabels || [],
        sitios: x.stats?.total ?? null, seoPromedio: x.stats?.avgSeoScore ?? null,
        publicada: toIso(x.publishedAt), url: auditReportUrl(d.id), publicadaEnRedes: toIso(x.publicadoEn) || null,
      };
    });
    const nextCursor = snap.docs.length > limit ? encodeCursor({ p: items.at(-1).publicada }) : null;
    return { summary: `${items.length} auditorías${nextCursor ? ' (hay más)' : ''}.`, data: { items, nextCursor } };
  },
});

export const getAuditTool = defineTool({
  name: 'get_audit',
  title: 'Ver auditoría',
  description: 'Detalle de un informe SEO: resumen, stats y los sitios auditados (paginados) con su puntaje, email y problemas encontrados.',
  inputSchema: z.object({ id: z.string().max(60).describe('Id de la auditoría.'), cursor: cursorSchema, limit: limitSchema }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const a = await loadAudit(db, args.id);
    const page = pageArray(a.results || [], { cursor: args.cursor, limit: args.limit ?? 20 });
    const items = page.items.map(r => ({
      placeId: r.id, nombre: r.nombre, ciudad: r.ciudad || null, rubro: r.tipo || null,
      web: r.siteUrl || null, seoScore: r.seoScore ?? null, email: r.email || null,
      problemas: problemasSeo(r),
    }));
    return {
      summary: `${a.title} — ${page.total} sitios, SEO promedio ${a.stats?.avgSeoScore ?? '—'}.`,
      data: {
        id: a.id, titulo: a.title, resumen: a.summary || null, stats: a.stats || null, url: auditReportUrl(a.id),
        publicadaEnRedes: toIso(a.publicadoEn) || null, items, nextCursor: page.nextCursor, total: page.total,
      },
    };
  },
});

export const createAuditReportTool = defineTool({
  name: 'create_audit_report',
  title: 'Crear informe de auditoría',
  description:
    'Arma y PUBLICA en la web (marianoaliandri.com.ar/auditorias) un informe SEO con los leads con web de una '
    + `búsqueda (search_id del historial o job_id de search_leads). Hacen falta al menos ${MIN_SITIOS_INFORME} sitios con web y puntaje. `
    + 'El informe público no muestra emails ni teléfonos. No publica en redes (eso es publish_audit_social).',
  inputSchema: z.object({
    search_id: z.string().max(60).optional().describe('Id de una búsqueda del historial.'),
    job_id: z.string().max(60).optional().describe('jobId de search_leads (ya terminado).'),
    title: z.string().min(5).max(200).optional().describe('Título propio; si no, se arma solo.'),
    summary: z.string().min(20).max(3000).optional().describe('Resumen propio; si no, se arma solo.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  async handler(args, { db, user }) {
    let s;
    if (args.job_id) {
      const job = await getLeadJob(db, user.uid, args.job_id);
      if (!job) throw new ToolError('No existe esa búsqueda (job_id).');
      if (job.status !== 'done') throw new ToolError('La búsqueda todavía no terminó.');
      s = { ciudades: job.params.localidades, tipos: job.params.rubros || [], terminos: job.params.terminos || [], radioKm: job.params.radio_km || 10, results: job.leads };
    } else if (args.search_id) {
      s = await getSearch(db, user.uid, args.search_id);
      if (!s) throw new ToolError('No existe esa búsqueda (search_id).');
    } else {
      throw new ToolError('Pasá search_id o job_id.');
    }

    const rubros = [...tipoParams(s.tipos || [], 'es').map(t => t.label), ...(s.terminos || [])];
    const draft = buildAuditReportDraft(s.results || [], {
      ciudades: (s.ciudades || []).map(ciudadDe), rubros, radioKm: s.radioKm || 10,
    });
    if (draft.stats.total < MIN_SITIOS_INFORME) {
      throw new ToolError(`Hacen falta al menos ${MIN_SITIOS_INFORME} leads con web y puntaje SEO; esta búsqueda tiene ${draft.stats.total}.`);
    }
    const title = args.title?.trim() || draft.title;
    const { id } = await saveAuditoria({
      title, summary: args.summary?.trim() || draft.summary, results: draft.filas, stats: draft.stats, config: draft.config,
    });
    revalidatePath('/auditorias');
    revalidatePath('/auditorias/[id]', 'page');
    const url = auditReportUrl(id);
    return { summary: `Informe publicado: ${url}`, data: { id, url, titulo: title, stats: draft.stats } };
  },
});

export const publishAuditSocialTool = defineTool({
  name: 'publish_audit_social',
  title: 'Publicar auditoría en redes',
  description:
    'Anuncia un informe en LinkedIn, Instagram y/o Facebook (vía Make) con la captura del informe como imagen. '
    + 'PUBLICA DE VERDAD en las redes de Mariano. Usá dry_run: true para ver qué se publicaría sin publicar. '
    + 'Si el informe ya se publicó, hace falta force: true.',
  inputSchema: z.object({
    id: z.string().max(60).describe('Id de la auditoría.'),
    networks: z.array(z.enum(NETWORKS)).min(1).max(3).describe('Redes donde publicar.'),
    caption: z.string().min(20).max(2000).optional().describe('Texto propio; si no, título + resumen del informe.'),
    force: z.boolean().optional().describe('Publicar aunque ya se haya publicado antes.'),
    dry_run: z.boolean().optional().describe('true = no publica, solo muestra el texto y verifica la imagen.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  async handler(args, { db }) {
    const a = await loadAudit(db, args.id);
    if (a.publicadoEn && !args.force && !args.dry_run) {
      throw new ToolError(`Este informe ya se publicó en redes (${toIso(a.publicadoEn)}). Pasá force: true para publicarlo otra vez.`);
    }
    const caption = args.caption?.trim() || `${a.title}\n\n${a.summary || ''}`.trim();
    // Make responde 200 aunque la imagen esté rota: se verifica antes (y de paso Microlink la cachea).
    const image = await imageIsReachable(auditScreenshotUrl(a.id));
    if (!image.ok) throw new ToolError(`La captura del informe no responde con una imagen (${image.detail}); no se publicó. Probá de nuevo en un rato.`);
    if (args.dry_run) {
      return { summary: `Prueba: se publicaría en ${args.networks.join(', ')}. Imagen OK.`, data: { dryRun: true, caption, networks: args.networks, imageOk: true } };
    }
    await postToMakeSocial(buildAuditPublishPayload({ caption, networks: args.networks, auditoriaId: a.id }));
    await a.ref.update({ publicadoEn: FieldValue.serverTimestamp(), publicadoVia: 'mcp', publicadoRedes: args.networks });
    return {
      summary: `Enviado a Make para ${args.networks.join(', ')}. Make acepta el pedido antes de publicar: confirmá en las redes.`,
      data: { enviado: true, networks: args.networks, url: auditReportUrl(a.id) },
    };
  },
});

export const AUDIT_TOOLS = [listAuditsTool, getAuditTool, createAuditReportTool, publishAuditSocialTool];
