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
import { listarBorradores, aprobarBorrador, descartarBorrador, ReviewError } from '@/lib/autoAuditReview';

const COL = 'auditorias';
const NETWORKS = ['linkedin', 'instagram', 'facebook'];
const CLAIM_MS = 2 * 60000;
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
    let s, sourceRef;
    if (args.job_id) {
      const job = await getLeadJob(db, user.uid, args.job_id);
      if (!job) throw new ToolError('No existe esa búsqueda (job_id).');
      if (job.status !== 'done') throw new ToolError('La búsqueda todavía no terminó.');
      s = { ciudades: job.params.localidades, tipos: job.params.rubros || [], terminos: job.params.terminos || [], radioKm: job.params.radio_km || 10, results: job.leads, auditoriaId: job.auditoriaId };
      sourceRef = db.collection('mcp_lead_jobs').doc(args.job_id);
    } else if (args.search_id) {
      s = await getSearch(db, user.uid, args.search_id);
      if (!s) throw new ToolError('No existe esa búsqueda (search_id).');
      sourceRef = db.collection('leadfinder_searches').doc(user.uid).collection('items').doc(args.search_id);
    } else {
      throw new ToolError('Pasá search_id o job_id.');
    }

    // Un reintento de Claude no publica un informe duplicado: se devuelve el que ya se armó.
    if (s.auditoriaId && (await db.collection(COL).doc(s.auditoriaId).get()).exists) {
      const url = auditReportUrl(s.auditoriaId);
      return { summary: `Esta búsqueda ya tiene su informe publicado: ${url}`, data: { id: s.auditoriaId, url, yaExistia: true } };
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
    await sourceRef.set({ auditoriaId: id }, { merge: true });
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
    // Se "toma" el informe en una transacción: dos llamadas en paralelo (o un reintento) no publican dos veces.
    const nowMs = Date.now();
    const claim = await db.runTransaction(async tx => {
      const x = (await tx.get(a.ref)).data() || {};
      if (x.publicando && nowMs - x.publicando < CLAIM_MS) return 'en_curso';
      if (x.publicadoEn && !args.force) return 'ya_publicado';
      tx.update(a.ref, { publicando: nowMs });
      return 'ok';
    });
    if (claim === 'en_curso') throw new ToolError('Este informe se está publicando ahora mismo; esperá un minuto y fijate con get_audit.');
    if (claim === 'ya_publicado') throw new ToolError('Este informe ya se publicó en redes. Pasá force: true para publicarlo otra vez.');
    try {
      await postToMakeSocial(buildAuditPublishPayload({ caption, networks: args.networks, auditoriaId: a.id }), { timeoutMs: 10000 });
    } catch (e) {
      await a.ref.update({ publicando: FieldValue.delete() });
      throw e;
    }
    await a.ref.update({ publicadoEn: FieldValue.serverTimestamp(), publicadoVia: 'mcp', publicadoRedes: args.networks, publicando: FieldValue.delete() });
    return {
      summary: `Enviado a Make para ${args.networks.join(', ')}. Make acepta el pedido antes de publicar: confirmá en las redes.`,
      data: { enviado: true, networks: args.networks, url: auditReportUrl(a.id) },
    };
  },
});

// Errores de la revisión (ya publicado, pocos sitios…) se le muestran a Claude tal cual.
async function conReview(fn) {
  try { return await fn(); } catch (e) { if (e instanceof ReviewError) throw new ToolError(e.message); throw e; }
}

export const listAuditDraftsTool = defineTool({
  name: 'list_audit_drafts',
  title: 'Borradores de la auditoría automática',
  description:
    'Lotes que dejó la auditoría automática para revisar antes de publicar (no son públicos todavía). '
    + 'Cada uno trae rubro, zona, cuántos comercios encontró Google, cuántos se examinaron, cuántos tenían web '
    + '(por localidad) y los sitios con su puntaje SEO y señales (plataforma, agencia, pauta). Revisá que los '
    + 'sitios sean del rubro (Google mezcla cadenas, supermercados, farmacias) y aprobá o descartá con review_audit_draft.',
  inputSchema: z.object({
    estado: z.enum(['pendiente', 'publicado', 'descartado', 'todos']).optional().describe('Default pendiente.'),
    limit: z.number().int().min(1).max(20).optional().describe('Cuántos (default 10).'),
  }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const items = (await listarBorradores(db, { estado: args.estado || 'pendiente', limit: args.limit ?? 10 })).map(b => ({
      id: b.id, estado: b.estado, rubro: b.rubro, zona: b.ciudad, localidades: b.localidades, creado: b.creado,
      busqueda: b.busqueda, stats: b.stats, redesPorDefecto: b.networks,
      auditoriaId: b.auditoriaId, url: b.auditoriaId ? auditReportUrl(b.auditoriaId) : null, motivo: b.motivo,
      sitios: b.results.map(r => ({
        placeId: r.id, nombre: r.nombre, ciudad: r.ciudad || null, web: r.siteUrl || null, seoScore: r.seoScore ?? null,
        rating: r.rating ?? null, email: r.email || null,
        plataforma: r.plataforma ?? null, agencia: r.agencia ?? null, anuncios: r.anuncios ?? null,
      })),
    }));
    return { summary: `${items.length} borradores${args.estado && args.estado !== 'pendiente' ? '' : ' pendientes'}.`, data: { items } };
  },
});

export const reviewAuditDraftTool = defineTool({
  name: 'review_audit_draft',
  title: 'Aprobar o descartar un borrador de auditoría',
  description:
    'aprobar: PUBLICA el informe en marianoaliandri.com.ar/auditorias (sin los sitios de `excluir`) y, si '
    + 'publicar_redes no es false, lo anuncia en LinkedIn/Instagram/Facebook vía Make + historia de Instagram. '
    + 'descartar: no publica nada. Usá dry_run: true para ver cuántos sitios quedarían. Mínimo 3 sitios.',
  inputSchema: z.object({
    id: z.string().max(60).describe('Id del borrador (de list_audit_drafts).'),
    accion: z.enum(['aprobar', 'descartar']),
    excluir: z.array(z.string().max(200)).max(30).optional().describe('placeIds a sacar del informe (no son del rubro, datos raros…).'),
    publicar_redes: z.boolean().optional().describe('false = solo el informe en la web, sin posts. Default true.'),
    networks: z.array(z.enum(NETWORKS)).min(1).max(3).optional().describe('Redes; si no, las de la config.'),
    motivo: z.string().max(500).optional().describe('Por qué se descarta (queda registrado).'),
    dry_run: z.boolean().optional().describe('true = no publica, solo muestra qué quedaría.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  async handler(args, { db }) {
    if (args.accion === 'descartar') {
      if (args.dry_run) return { summary: 'Prueba: se descartaría el borrador.', data: { dryRun: true } };
      const out = await conReview(() => descartarBorrador(db, args.id, args.motivo));
      return { summary: 'Borrador descartado: no se publicó nada.', data: out };
    }
    const out = await conReview(() => aprobarBorrador(db, args.id, {
      redes: args.publicar_redes !== false, networks: args.networks, excluir: args.excluir || [], dryRun: args.dry_run === true,
    }));
    if (out.dryRun) {
      return { summary: `Prueba: saldría un informe de ${out.sitios} sitios${out.redes.length ? ` y posts en ${out.redes.join(', ')}` : ' sin posts'}.`, data: out };
    }
    revalidatePath('/auditorias');
    revalidatePath('/auditorias/[id]', 'page');
    const url = auditReportUrl(out.auditoriaId);
    const redes = out.estado === 'ok' ? ' y enviado a Make para las redes' : out.estado === 'guardado' ? '' : ` — redes: ${out.error}`;
    return {
      summary: `Informe publicado (${out.sitios} sitios): ${url}${redes}.`,
      data: { auditoriaId: out.auditoriaId, url, estado: out.estado, error: out.error || null, historia: out.historia || null },
    };
  },
});

export const AUDIT_TOOLS = [listAuditsTool, getAuditTool, createAuditReportTool, publishAuditSocialTool, listAuditDraftsTool, reviewAuditDraftTool];
