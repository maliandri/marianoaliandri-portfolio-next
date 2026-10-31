export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { requireAdmin } from '@/lib/adminAuth';
import { buildBizEmailDraft, renderBizEmailHtml, sendViaResend } from '@/lib/bizEmail';
import { checkBlocked, normalizeDomain, unsubscribeUrl } from '@/lib/emailGuards';

// Botón "✉ Enviar" del admin. La lógica del mail vive en src/lib/bizEmail.js (compartida con el
// servidor MCP). Acá solo se respeta la lista de bloqueo (bajas y rebotes); los frenos de
// "30 días" y tope diario son del envío automático del MCP.
export async function POST(request) {
  const { response } = await requireAdmin(request);
  if (response) return response;
  try {
    const body = await request.json();
    const {
      nombre, siteUrl, email, seoScore, hasSitemap, hasRobots, metaDesc, hasOG,
      ciudad, tipo, auditoriaId, anuncios, plataforma,
      preview,                       // true = solo generar el texto, no enviar
      emailText: providedText,       // texto ya generado/editado por el admin (opcional)
      screenshotUrl: providedShot,   // screenshot ya obtenido en el preview (opcional)
    } = body;

    if (!nombre || !siteUrl) return Response.json({ error: 'nombre y siteUrl requeridos' }, { status: 400 });

    // Para enviar (no preview) hacen falta email y Resend configurado
    if (!preview) {
      if (!email) return Response.json({ error: 'Email requerido' }, { status: 400 });
      if (!process.env.RESEND_API_KEY) {
        console.error('[send-biz-email] RESEND_API_KEY no configurada');
        return Response.json({ error: 'RESEND_API_KEY no configurada' }, { status: 500 });
      }
    }

    const db = getDb();
    const dominio = normalizeDomain(siteUrl);
    if (!preview && db) {
      const bloqueo = await checkBlocked(db, { email, dominio });
      if (bloqueo) {
        const motivo = bloqueo === 'baja' ? 'pidió no recibir más mails' : 'esa dirección rebotó o marcó spam';
        return Response.json({ error: `No se envía: ${motivo}`, bloqueo }, { status: 409 });
      }
    }

    const neg = { nombre, siteUrl, seoScore, hasSitemap, hasRobots, metaDesc, hasOG, ciudad, tipo, anuncios, plataforma };
    const { subject, emailText, source, screenshotUrl, extraServices } =
      await buildBizEmailDraft(neg, { providedText, providedShot });

    // Modo preview: devolver el texto + screenshot sin enviar nada
    if (preview) {
      return Response.json({ success: true, preview: true, emailText, screenshotUrl, source, extraServices });
    }

    const html = renderBizEmailHtml({
      nombre, siteUrl, seoScore, emailText, screenshotUrl, extraServices, unsubscribeUrl: unsubscribeUrl(email),
    });
    const { resendId } = await sendViaResend({ to: email, subject, html });

    // Guardar registro del envío en Firestore (no romper el envío si falla)
    try {
      if (db) {
        await db.collection('sent_emails').add({
          nombre, email, siteUrl, dominio, ciudad: ciudad || null, tipo: tipo || null,
          seoScore: seoScore ?? null, auditoriaId: auditoriaId || null,
          subject, body: emailText, screenshotUrl: screenshotUrl || null,
          extraServices: extraServices.map(s => s.label),
          source: source || null, resendId,
          origen: 'admin',
          status: 'sent',
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (logErr) {
      console.error('[send-biz-email] no se pudo guardar el registro:', logErr.message);
    }

    return Response.json({ success: true, emailId: resendId, emailText, source, extraServices });
  } catch (e) {
    console.error('[send-biz-email] ERROR:', e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
