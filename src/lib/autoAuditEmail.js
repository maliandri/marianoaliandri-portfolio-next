import { FieldValue } from 'firebase-admin/firestore';
import { buildBizEmailDraft, renderBizEmailHtml, sendViaResend, validateGeneratedEmail } from '@/lib/bizEmail';
import { checkBlocked, normalizeDomain, reserveSend, unsubscribeUrl } from '@/lib/emailGuards';

// Envío automático del mail de auditoría a los negocios de un informe recién publicado.
// Apagado por defecto (config.emailAuto). Frenos: lista de bajas y rebotes, un mail por negocio
// cada 30 días, tope diario propio (config.emailTope) y freno si los últimos envíos rebotaron.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COUNTER = 'auto_email_counter'; // aparte del tope del MCP
const RECONTACT_DAYS = 30;
const REVISAR_ULTIMOS = 20;           // cuántos envíos automáticos mira el freno por rebotes
const MAX_MALOS = 2;                  // rebotes + quejas que pausan el envío automático
const AVISO_A = 'yo@marianoaliandri.com.ar';

export const SEO_MAX_PARA_MAIL = 70;  // se escribe solo a quienes tienen menos de 70
export const EMAIL_TOPE_DEFAULT = 10;
export const EMAIL_TOPE_MAX = 30;

// true si entre los últimos envíos automáticos hay demasiados rebotes o quejas.
async function hayRebotes(db) {
  const snap = await db.collection('sent_emails').where('origen', '==', 'auto').orderBy('createdAt', 'desc').limit(REVISAR_ULTIMOS).get();
  const malos = snap.docs.filter(d => ['bounced', 'complained'].includes(d.data().status)).length;
  return malos >= MAX_MALOS;
}

async function mandarUno(db, neg, { tope, now }) {
  if (!neg.email || !EMAIL_RE.test(neg.email) || !neg.siteUrl) return { motivo: 'sin_email' };
  // Solo a quienes tienen margen de mejora: con 70 o más no hay nada que ofrecerles en SEO.
  if (typeof neg.seoScore !== 'number' || neg.seoScore >= SEO_MAX_PARA_MAIL) return { motivo: 'seo_alto' };
  const email = neg.email.trim().toLowerCase();
  const dominio = normalizeDomain(neg.siteUrl);
  const bloqueo = await checkBlocked(db, { email, dominio });
  if (bloqueo) return { motivo: bloqueo };

  const draft = await buildBizEmailDraft({ ...neg, email });
  // Sin revisión humana: si el texto no pasa la red mínima, no sale.
  if (!validateGeneratedEmail(draft.emailText, neg.nombre)) return { motivo: 'texto_invalido' };
  const html = renderBizEmailHtml({
    nombre: neg.nombre, siteUrl: neg.siteUrl, seoScore: neg.seoScore, emailText: draft.emailText,
    screenshotUrl: draft.screenshotUrl, extraServices: draft.extraServices, unsubscribeUrl: unsubscribeUrl(email),
  });

  const reserva = await reserveSend(db, { email, dominio, cap: tope, days: RECONTACT_DAYS, now, counter: COUNTER });
  if (!reserva.ok) return { motivo: reserva.motivo };

  let resendId;
  try {
    ({ resendId } = await sendViaResend({ to: email, subject: draft.subject, html }));
  } catch (e) {
    await reserva.release();
    return { motivo: 'error_envio', detalle: e.message };
  }
  try {
    await db.collection('sent_emails').add({
      nombre: neg.nombre, email, siteUrl: neg.siteUrl, dominio, placeId: neg.id || null,
      ciudad: neg.ciudad || null, tipo: neg.tipo || null, seoScore: neg.seoScore ?? null, auditoriaId: neg.auditoriaId || null,
      subject: draft.subject, body: draft.emailText, screenshotUrl: draft.screenshotUrl || null,
      extraServices: (draft.extraServices || []).map(s => s.label), source: draft.source || null, resendId,
      origen: 'auto', status: 'sent', createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.error('[auto-email] el mail salió pero no se pudo registrar:', e.message);
  }
  return { enviado: true, source: draft.source };
}

// Aviso al admin con lo que salió. Un fallo acá no cambia nada del envío.
async function avisar({ combo, enviados, omitidos, pausado }) {
  try {
    const filas = enviados.map(e => `<li>${e.nombre} — ${e.email} (${e.source || 'texto'})</li>`).join('');
    const motivos = Object.entries(omitidos).map(([m, n]) => `${m}: ${n}`).join(', ');
    const html = `<p>Auditoría de ${combo.rubro.label} en ${combo.ciudad}.</p>`
      + (pausado ? '<p><strong>Envío automático pausado: rebotaron o marcaron spam varios de los últimos mails.</strong> Revisalo en el admin.</p>' : '')
      + `<p>Mails enviados: ${enviados.length}</p><ul>${filas}</ul>`
      + (motivos ? `<p>No enviados — ${motivos}</p>` : '');
    await sendViaResend({ to: AVISO_A, subject: `Mails automáticos: ${enviados.length} enviados`, html });
  } catch (e) {
    console.error('[auto-email] no se pudo mandar el resumen:', e.message);
  }
}

// Devuelve { enviados, omitidos: {motivo: n}, pausado }. Nunca tira: un problema acá no debe
// romper la corrida de la auditoría. Si el freno por rebotes salta, apaga config.emailAuto.
export async function enviarMailsAuditoria(db, { combo, results, auditoriaId, config, configRef, now = new Date() }) {
  const out = { enviados: 0, omitidos: {}, pausado: false };
  if (config.emailAuto !== true) return out;
  const tope = Number.isInteger(config.emailTope) ? Math.min(EMAIL_TOPE_MAX, Math.max(1, config.emailTope)) : EMAIL_TOPE_DEFAULT;
  const enviados = [];
  try {
    if (await hayRebotes(db)) {
      out.pausado = true;
      await configRef.set({ emailAuto: false }, { merge: true });
    } else {
      for (const r of results) {
        if (!r.email) continue;
        const res = await mandarUno(db, { ...r, auditoriaId }, { tope, now });
        if (res.enviado) { out.enviados++; enviados.push({ nombre: r.nombre, email: r.email, source: res.source }); continue; }
        out.omitidos[res.motivo] = (out.omitidos[res.motivo] || 0) + 1;
        if (res.motivo === 'tope_diario') break;
      }
    }
  } catch (e) {
    console.error('[auto-email] error:', e.message);
    out.error = e.message;
  }
  if (out.enviados || out.pausado) await avisar({ combo, enviados, omitidos: out.omitidos, pausado: out.pausado });
  return out;
}
