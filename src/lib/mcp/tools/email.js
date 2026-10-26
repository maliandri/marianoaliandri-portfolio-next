import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { buildBizEmailDraft, renderBizEmailHtml, sendViaResend, validateGeneratedEmail } from '@/lib/bizEmail';
import { checkBlocked, lastContactAt, normalizeDomain, reserveSend, unsubscribeUrl } from '@/lib/emailGuards';
import { getSearch } from '@/lib/leadSearchesStore';
import { envInt } from '../config';
import { defineTool, ToolError } from '../defineTool';
import { decodeCursor, encodeCursor } from '../paginate';
import { getLeadJob } from '../leadJobs';

// Contacto por mail a negocios. Los frenos viven acá, en el servidor (spec 6.4): lista de bloqueo,
// 30 días sin volver a escribirle al mismo negocio y tope diario. Pensado para rutinas sin supervisión.

const DRAFTS = 'mcp_email_drafts';
const DRAFT_TTL_MS = 7 * 86400000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DAY_MS = 86400000;

const negocioSchema = {
  audit_id: z.string().max(60).optional().describe('Id de la auditoría donde está el negocio.'),
  search_id: z.string().max(60).optional().describe('Id de una búsqueda del historial.'),
  job_id: z.string().max(60).optional().describe('jobId de search_leads.'),
  place_id: z.string().max(200).optional().describe('placeId del negocio (campo placeId de los leads).'),
};

async function findNegocio(db, user, { audit_id, search_id, job_id, place_id }) {
  if (!place_id) throw new ToolError('Falta place_id.');
  let rows;
  if (audit_id) {
    const snap = await db.collection('auditorias').doc(audit_id).get();
    if (!snap.exists) throw new ToolError('No existe esa auditoría.');
    rows = snap.data().results || [];
  } else if (search_id) {
    const s = await getSearch(db, user.uid, search_id);
    if (!s) throw new ToolError('No existe esa búsqueda.');
    rows = s.results || [];
  } else if (job_id) {
    const j = await getLeadJob(db, user.uid, job_id);
    if (!j) throw new ToolError('No existe esa búsqueda (job_id).');
    rows = j.leads || [];
  } else {
    throw new ToolError('Pasá audit_id, search_id o job_id junto con place_id.');
  }
  const r = rows.find(x => x.id === place_id);
  if (!r) throw new ToolError('Ese negocio no está en esa auditoría/búsqueda.');
  if (!r.siteUrl) throw new ToolError('Ese negocio no tiene web: el mail es sobre su sitio.');
  if (!r.email || !EMAIL_RE.test(r.email)) throw new ToolError('Ese negocio no tiene un email público.');
  return {
    placeId: r.id, nombre: r.nombre, siteUrl: r.siteUrl, email: r.email.trim().toLowerCase(), seoScore: r.seoScore ?? null,
    hasSitemap: r.hasSitemap, hasRobots: r.hasRobots, metaDesc: r.metaDesc, hasOG: r.hasOG,
    ciudad: r.ciudad || null, tipo: r.tipo || null, auditoriaId: audit_id || null,
  };
}

// null si se le puede escribir; si no, el motivo.
async function motivoBloqueo(db, neg, now) {
  const dominio = normalizeDomain(neg.siteUrl);
  const b = await checkBlocked(db, { email: neg.email, dominio });
  if (b) return { motivo: b };
  const last = await lastContactAt(db, { email: neg.email, dominio });
  const dias = envInt('MCP_EMAIL_RECONTACT_DAYS', 30);
  if (last && now - last < dias * DAY_MS) {
    return { motivo: 'ya_contactado', dias: Math.floor((now - last) / DAY_MS) };
  }
  return null;
}

const MOTIVO_TXT = {
  baja: 'pidió no recibir más mails',
  rebotado: 'esa dirección rebotó o marcó spam',
  ya_contactado: 'ya se le escribió hace menos de 30 días',
  tope_diario: 'se llegó al tope diario de mails del MCP',
};

export const draftBusinessEmailTool = defineTool({
  name: 'draft_business_email',
  title: 'Redactar mail a un negocio',
  description:
    'Redacta (sin enviar) el mail comercial para un negocio auditado: Gemini escribe el texto a partir de su puntaje '
    + 'SEO y sus problemas (si falla, plantilla fija). Devuelve un draftId para send_business_email y avisa si al '
    + 'negocio no se le puede escribir (baja, rebote o contactado hace poco).',
  inputSchema: z.object(negocioSchema),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  async handler(args, { db, user, now = new Date() }) {
    const neg = await findNegocio(db, user, args);
    const d = await buildBizEmailDraft(neg);
    const bloqueo = await motivoBloqueo(db, neg, now);
    const ref = await db.collection(DRAFTS).add({
      uid: user.uid, ...neg, dominio: normalizeDomain(neg.siteUrl),
      subject: d.subject, emailText: d.emailText, source: d.source, screenshotUrl: d.screenshotUrl || null,
      extraServices: d.extraServices, expiresAt: now.getTime() + DRAFT_TTL_MS, sentAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      summary: bloqueo
        ? `Borrador listo, pero no se le puede escribir: ${MOTIVO_TXT[bloqueo.motivo]}.`
        : `Borrador listo para ${neg.email} (${d.source}).`,
      data: {
        draftId: ref.id, to: neg.email, subject: d.subject, emailText: d.emailText, source: d.source,
        bloqueo: bloqueo ? bloqueo.motivo : null,
      },
    };
  },
});

export const sendBusinessEmailTool = defineTool({
  name: 'send_business_email',
  title: 'Mandar mail a un negocio',
  description:
    'MANDA DE VERDAD el mail comercial a un negocio (Resend, desde notificaciones@marianoaliandri.com.ar, con link '
    + 'de baja). Pasá draft_id (de draft_business_email) o el negocio (audit_id/search_id/job_id + place_id) para '
    + 'redactar y mandar en un paso. Frenos del servidor: no le escribe a quien pidió la baja o rebotó, ni al mismo '
    + 'negocio antes de 30 días, y respeta un tope diario. Si un freno lo frena devuelve enviado: false y el motivo '
    + '(no es un error: seguí con el próximo). dry_run: true revisa todo sin mandar.',
  inputSchema: z.object({
    draft_id: z.string().max(60).optional().describe('draftId de draft_business_email.'),
    ...negocioSchema,
    email_text: z.string().min(300).max(2500).optional().describe('Texto propio del mail (reemplaza el del borrador).'),
    dry_run: z.boolean().optional().describe('true = revisa frenos y texto pero no manda.'),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
  async handler(args, { db, user, now = new Date() }) {
    let neg, d, draftRef = null;
    if (args.draft_id) {
      draftRef = db.collection(DRAFTS).doc(args.draft_id);
      const snap = await draftRef.get();
      const x = snap.exists ? snap.data() : null;
      if (!x || x.uid !== user.uid) throw new ToolError('No existe ese borrador.');
      if (x.sentAt) throw new ToolError('Ese borrador ya se envió.');
      if (x.expiresAt < now.getTime()) throw new ToolError('El borrador venció; hacé uno nuevo con draft_business_email.');
      neg = x;
      d = { subject: x.subject, emailText: x.emailText, source: x.source, screenshotUrl: x.screenshotUrl, extraServices: x.extraServices };
    } else {
      neg = await findNegocio(db, user, args);
    }
    if (args.email_text) {
      if (!validateGeneratedEmail(args.email_text, neg.nombre)) {
        throw new ToolError('El texto no pasa la revisión: tiene que nombrar al negocio, no tener marcadores sin completar y solo links de marianoaliandri.com.ar o wa.me.');
      }
      d = { ...(d || {}), emailText: args.email_text, source: 'mcp' };
    }

    const bloqueo = await motivoBloqueo(db, neg, now);
    if (bloqueo) {
      return { summary: `No se envió a ${neg.email}: ${MOTIVO_TXT[bloqueo.motivo]}.`, data: { enviado: false, motivo: bloqueo.motivo, to: neg.email } };
    }
    if (!d?.subject) {
      const built = await buildBizEmailDraft(neg, d?.emailText ? { providedText: d.emailText } : {});
      d = { ...built, source: d?.source || built.source };
    }
    if (args.dry_run) {
      return { summary: `Prueba: se mandaría a ${neg.email}.`, data: { enviado: false, dryRun: true, to: neg.email, subject: d.subject, emailText: d.emailText } };
    }
    // Se arma antes de reservar: si falta EMAIL_UNSUBSCRIBE_SECRET falla sin gastar cupo.
    const html = renderBizEmailHtml({
      nombre: neg.nombre, siteUrl: neg.siteUrl, seoScore: neg.seoScore, emailText: d.emailText,
      screenshotUrl: d.screenshotUrl, extraServices: d.extraServices, unsubscribeUrl: unsubscribeUrl(neg.email),
    });

    const dominio = normalizeDomain(neg.siteUrl);
    const reserva = await reserveSend(db, {
      email: neg.email, dominio, cap: envInt('MCP_EMAIL_DAILY_CAP', 15),
      days: envInt('MCP_EMAIL_RECONTACT_DAYS', 30), now, draftRef,
    });
    if (!reserva.ok) {
      if (reserva.motivo === 'borrador_enviado') throw new ToolError('Ese borrador ya se envió.');
      return { summary: `No se envió a ${neg.email}: ${MOTIVO_TXT[reserva.motivo]}.`, data: { enviado: false, motivo: reserva.motivo, to: neg.email } };
    }

    let resendId;
    try {
      ({ resendId } = await sendViaResend({ to: neg.email, subject: d.subject, html }));
    } catch (e) {
      await reserva.release();
      throw e;
    }
    // Ya salió: si falla el registro, el candado de reserveSend igual evita reenviarlo.
    try {
      await db.collection('sent_emails').add({
        nombre: neg.nombre, email: neg.email, siteUrl: neg.siteUrl, dominio, placeId: neg.placeId,
        ciudad: neg.ciudad || null, tipo: neg.tipo || null, seoScore: neg.seoScore ?? null, auditoriaId: neg.auditoriaId || null,
        subject: d.subject, body: d.emailText, screenshotUrl: d.screenshotUrl || null,
        extraServices: (d.extraServices || []).map(s => s.label), source: d.source || null, resendId,
        origen: 'mcp', status: 'sent', createdAt: FieldValue.serverTimestamp(),
      });
      if (draftRef) await draftRef.update({ sentAt: now.getTime(), sending: false });
    } catch (e) {
      console.error('[mcp] el mail salió pero no se pudo registrar:', e.message);
    }
    return { summary: `Mail enviado a ${neg.email} (${neg.nombre}).`, data: { enviado: true, to: neg.email, subject: d.subject } };
  },
});

export const listSentEmailsTool = defineTool({
  name: 'list_sent_emails',
  title: 'Mails enviados',
  description: 'Mails comerciales enviados a negocios, más nuevos primero, con su estado en Resend (sent, delivered, opened, bounced, complained) y origen (admin = botón del panel, mcp = Claude).',
  inputSchema: z.object({
    origen: z.enum(['mcp', 'admin']).optional().describe('Filtrar por origen.'),
    cursor: z.string().optional().describe('nextCursor de la llamada anterior.'),
    limit: z.number().int().min(1).max(50).optional().describe('Cuántos (default 20, máx 50).'),
  }),
  annotations: { readOnlyHint: true },
  async handler(args, { db }) {
    const limit = args.limit ?? 20;
    // Los registros viejos no tienen `origen` (son del admin): se filtra en memoria sobre una tanda.
    let q = db.collection('sent_emails').orderBy('createdAt', 'desc');
    const c = decodeCursor(args.cursor);
    if (c?.t) q = q.startAfter(new Date(c.t));
    const batch = (await q.limit(limit * 4 + 1).get()).docs;
    const out = [];
    let lastScanned = null;
    for (const doc of batch.slice(0, limit * 4)) {
      const x = doc.data();
      lastScanned = x.createdAt?.toDate?.()?.toISOString() || lastScanned;
      const origen = x.origen === 'mcp' ? 'mcp' : 'admin';
      if (args.origen && origen !== args.origen) continue;
      out.push({ to: x.email, nombre: x.nombre || null, dominio: x.dominio || normalizeDomain(x.siteUrl), status: x.status || 'sent', origen, enviado: x.createdAt?.toDate?.()?.toISOString() || null });
      if (out.length === limit) break;
    }
    const more = out.length === limit ? out.at(-1).enviado : (batch.length > limit * 4 ? lastScanned : null);
    const nextCursor = more ? encodeCursor({ t: more }) : null;
    return { summary: `${out.length} mails${nextCursor ? ' (hay más)' : ''}.`, data: { items: out, nextCursor } };
  },
});

export const EMAIL_TOOLS = [draftBusinessEmailTool, sendBusinessEmailTool, listSentEmailsTool];
