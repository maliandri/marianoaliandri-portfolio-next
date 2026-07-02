export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';

const SITE_URL = 'https://marianoaliandri.com.ar';
const ADMIN_EMAIL = 'marianoaliandri@gmail.com';

export async function GET(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const doc = await db.collection('auditorias').doc(id).get();
      if (!doc.exists) return Response.json({ error: 'No encontrado' }, { status: 404 });
      const data = doc.data();
      return Response.json({
        id: doc.id,
        ...data,
        createdAt:   data.createdAt?.toDate?.()?.toISOString()   || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      });
    }

    const snap = await db.collection('auditorias').orderBy('publishedAt', 'desc').limit(50).get();
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title:       data.title,
        config:      data.config,
        stats:       data.stats,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
      };
    });
    return Response.json(list);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(25000),
      }
    );
    const data = await resp.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch { return null; }
}

async function generateSummary({ config, stats, results }) {
  const ciudades  = (config?.ciudades || []).join(', ') || 'la zona analizada';
  const tipos     = (config?.tiposLabels || []).slice(0, 8).join(', ');
  const total     = stats?.total ?? results.length;
  const lowSeo    = stats?.lowSeoCount ?? 0;
  const avg       = stats?.avgSeoScore ?? '—';
  const withEmail = stats?.withEmail ?? 0;
  const pctLow    = total > 0 ? Math.round(lowSeo / total * 100) : 0;

  return callGemini(`Sos un analista de presencia digital argentina. Escribí un texto de 4 a 5 oraciones en español rioplatense (vos, no tú) que resuma los resultados de esta auditoría SEO de negocios locales con sitio web propio.

Datos:
- Ciudades: ${ciudades}
- Tipos de negocio: ${tipos}
- Total de sitios auditados: ${total}
- Score SEO promedio: ${avg}/100
- Sitios con SEO débil (< 50): ${lowSeo} (${pctLow}%)
- Con email público: ${withEmail}

El texto debe explicar qué significa un SEO débil para un negocio local, destacar la oportunidad de mejora en la zona, sonar profesional y accesible. Sin listas ni bullets, solo prosa corrida. Sin precios ni publicidad directa.`);
}

async function generateEmailBody({ title, config, stats, reportUrl }) {
  const ciudades = (config?.ciudades || []).join(', ') || 'la zona';
  const tipos    = (config?.tiposLabels || []).slice(0, 6).join(', ');
  const total    = stats?.total ?? 0;
  const lowSeo   = stats?.lowSeoCount ?? 0;
  const avg      = stats?.avgSeoScore ?? '—';

  return callGemini(`Sos Mariano Aliandri, desarrollador Full Stack y analista de datos. Acabás de publicar un reporte de auditoría SEO de negocios locales.

Escribí el cuerpo de un email de notificación interno (para vos mismo) anunciando la publicación del reporte. El email debe:
- Saludar brevemente en primera persona
- Mencionar el nombre del reporte: "${title}"
- Resumir los datos clave: ${total} sitios auditados en ${ciudades}, score SEO promedio ${avg}/100, ${lowSeo} sitios con SEO débil
- Tipos analizados: ${tipos}
- Invitar a ver el reporte completo en: ${reportUrl}
- Cerrar con una nota sobre la oportunidad de negocio que representa

Tono: profesional y entusiasta. En español rioplatense. Solo el cuerpo del email, sin asunto ni firma (se agrega automáticamente). Sin markdown, solo texto plano con saltos de línea.`);
}

async function getScreenshot(url) {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    const data = await resp.json();
    return data?.data?.screenshot?.url || null;
  } catch { return null; }
}

async function sendAuditEmail({ title, config, stats, summary, reportUrl, screenshotUrl }) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const resend = new Resend(resendKey);
  const emailBody = await generateEmailBody({ title, config, stats, reportUrl });

  const ciudades = (config?.ciudades || []).join(', ') || 'zona analizada';
  const bodyText = emailBody || `Se publicó el reporte "${title}" con ${stats?.total ?? 0} sitios auditados en ${ciudades}. Ver en: ${reportUrl}`;

  const bodyLines = bodyText.split('\n').map(l => `<p style="margin:0 0 12px;color:#374151;line-height:1.6">${l || '&nbsp;'}</p>`).join('');

  const screenshotHtml = screenshotUrl
    ? `<div style="margin:24px 0;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <a href="${reportUrl}" target="_blank">
          <img src="${screenshotUrl}" alt="Vista previa del reporte" style="width:100%;display:block" />
        </a>
       </div>`
    : '';

  const summaryHtml = summary
    ? `<div style="background:#f0f4ff;border-left:4px solid #6366f1;padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.05em">Análisis Gemini</p>
        <p style="margin:0;color:#374151;font-size:14px;line-height:1.6">${summary}</p>
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 40px">
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:0.1em">Nuevo reporte publicado</p>
      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;line-height:1.3">${title}</h1>
    </div>

    <!-- Stats pills -->
    <div style="display:flex;gap:0;border-bottom:1px solid #f3f4f6">
      ${[
        { v: stats?.total ?? '—',       l: 'Sitios',       c: '#1f2937' },
        { v: stats?.lowSeoCount ?? '—', l: 'SEO débil',    c: '#ef4444' },
        { v: (stats?.avgSeoScore ?? '—') + (stats?.avgSeoScore != null ? '/100' : ''), l: 'Score prom.', c: '#6366f1' },
        { v: stats?.withEmail ?? '—',   l: 'Con email',    c: '#10b981' },
      ].map(s => `<div style="flex:1;padding:16px;text-align:center;border-right:1px solid #f3f4f6">
        <div style="font-size:22px;font-weight:800;color:${s.c}">${s.v}</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:2px">${s.l}</div>
      </div>`).join('')}
    </div>

    <!-- Body -->
    <div style="padding:32px 40px">
      ${bodyLines}
      ${screenshotHtml}
      ${summaryHtml}

      <div style="text-align:center;margin-top:32px">
        <a href="${reportUrl}" target="_blank"
          style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px">
          Ver reporte completo →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Mariano Aliandri · <a href="${SITE_URL}" style="color:#6366f1;text-decoration:none">marianoaliandri.com.ar</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from:     'Mariano Aliandri <notificaciones@marianoaliandri.com.ar>',
    to:       ADMIN_EMAIL,
    reply_to: ADMIN_EMAIL,
    subject:  `📊 Reporte publicado: ${title}`,
    html,
  });
}

export async function POST(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const body = await request.json();
    const { title, config, results, stats } = body;
    if (!title || !results?.length) {
      return Response.json({ error: 'title y results son requeridos' }, { status: 400 });
    }

    // Sanitizar: quitar datos privados antes de guardar
    const publicResults = results.map(r => ({
      id:           r.id,
      nombre:       r.nombre,
      ciudad:       r.ciudad || null,
      tipo:         r.tipo,
      siteUrl:      r.siteUrl,
      seoScore:     r.seoScore,
      hasSitemap:   r.hasSitemap,
      hasRobots:    r.hasRobots,
      metaDesc:     r.metaDesc ? true : r.metaDesc === null ? null : false,
      hasOG:        r.hasOG,
      lastModified: r.lastModified || null,
      rating:       r.rating || null,
    }));

    // Generar resumen Gemini para el reporte
    const summary = await generateSummary({ config, stats, results: publicResults });

    // Guardar en Firestore
    const docRef = await db.collection('auditorias').add({
      title,
      config,
      results: publicResults,
      stats,
      summary: summary || null,
      publishedAt: FieldValue.serverTimestamp(),
      createdAt:   FieldValue.serverTimestamp(),
    });

    const reportUrl = `${SITE_URL}/auditorias/${docRef.id}`;

    // Screenshot + email en paralelo (no bloqueamos la respuesta)
    Promise.allSettled([
      getScreenshot(reportUrl),
    ]).then(([ssResult]) => {
      const screenshotUrl = ssResult.status === 'fulfilled' ? ssResult.value : null;
      sendAuditEmail({ title, config, stats, summary, reportUrl, screenshotUrl }).catch(() => {});
    });

    return Response.json({ success: true, id: docRef.id });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id requerido' }, { status: 400 });

    await db.collection('auditorias').doc(id).delete();
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
