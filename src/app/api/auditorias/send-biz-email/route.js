export const dynamic = 'force-dynamic';
import { Resend } from 'resend';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const SITE_URL   = 'https://marianoaliandri.com.ar';

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await resp.json();
  // Surface el error real de Google en vez de un mensaje genérico
  if (!resp.ok || data?.error) {
    throw new Error(`Gemini ${resp.status}: ${data?.error?.message || 'error desconocido'}`);
  }
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Gemini no generó texto (posible bloqueo de contenido)');
  return text;
}

async function getScreenshot(url) {
  try {
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
    const resp = await fetch(apiUrl, { signal: AbortSignal.timeout(15000) });
    const data = await resp.json();
    return data?.data?.screenshot?.url || null;
  } catch { return null; }
}

// Plantilla escrita a mano — se usa como fallback cuando Gemini no está disponible.
// Personaliza el cuerpo con los datos reales de cada negocio.
function buildTemplateEmail({ nombre, siteUrl, seoScore, ciudad, problemas, nivelSeo }) {
  const cleanUrl = (siteUrl || '').replace(/^https?:\/\/(www\.)?/, '').split(/[?#]/)[0].replace(/\/$/, '');
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  const saludo = `Hola equipo de ${nombre},`;

  const intro = `Soy Mariano Aliandri, desarrollador web y analista de datos. Ayudo a negocios${ciudad ? ` de ${ciudad}` : ''} a mejorar su presencia en internet para que aparezcan mejor en Google y les lleguen más clientes.`;

  const analisis = `Estuve revisando su sitio web (${cleanUrl}) y encontré algunas oportunidades concretas para mejorarlo. Hoy tiene un puntaje SEO de ${seoScore ?? '—'}/100, un nivel ${nivelSeo}.`;

  const detalle = problemas.length
    ? `Puntualmente, detecté que el sitio:\n${problemas.map(p => `• ${cap(p)}`).join('\n')}`
    : `La base está bien armada, pero hay algunos detalles finos que se pueden pulir para ganar posiciones en Google.`;

  const impacto = `¿Por qué importa esto? Cuando un sitio tiene estos puntos flojos, Google lo muestra más abajo en los resultados y muchos clientes potenciales terminan eligiendo a un competidor que aparece antes. Corregirlo suele traducirse en más visitas y más consultas, sin necesidad de gastar en publicidad.`;

  const cierre = `Si te interesa, respondé este mail y coordinamos una charla sin compromiso para revisarlo juntos y ver qué conviene priorizar.\n\nSaludos,\nMariano Aliandri`;

  return [saludo, intro, analisis, detalle, impacto, cierre].join('\n\n');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      nombre, siteUrl, email, seoScore, hasSitemap, hasRobots, metaDesc, hasOG,
      ciudad, tipo, auditoriaId,
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

    // Construir lista de problemas SEO
    const problemas = [];
    if (!hasSitemap) problemas.push('no tiene sitemap.xml (Google no puede rastrear fácilmente el sitio)');
    if (!hasRobots)  problemas.push('no tiene robots.txt (falta configuración de rastreo)');
    if (!metaDesc)   problemas.push('le faltan meta descriptions (los resultados de Google no tienen descripción atractiva)');
    if (!hasOG)      problemas.push('no tiene Open Graph (las publicaciones en redes sociales no se ven bien)');

    const nivelSeo = seoScore >= 70 ? 'aceptable' : seoScore >= 40 ? 'mejorable' : 'débil';

    // Origen del cuerpo del email: editado por el admin > Gemini > plantilla propia
    let emailText;
    let source;
    if (providedText?.trim()) {
      emailText = providedText.trim();
      source = 'edited';
    } else {
      const prompt = `Sos Mariano Aliandri, desarrollador Full Stack y analista de datos de ${SITE_URL}.
Escribí el cuerpo de un email comercial personalizado para el negocio "${nombre}"${ciudad ? ` de ${ciudad}` : ''}, rubro ${tipo || 'comercio'}.

Su sitio web es ${siteUrl}.
Su Score SEO es ${seoScore ?? '—'}/100 (nivel: ${nivelSeo}).
${problemas.length > 0 ? `Problemas encontrados:\n${problemas.map(p => `- ${p}`).join('\n')}` : 'No se encontraron problemas críticos.'}

El email debe:
- Saludar al negocio por su nombre en la primera línea
- Presentarte brevemente como especialista en presencia digital
- Mencionarles que analizaste su sitio web y encontraste oportunidades de mejora
- Explicar en 2-3 oraciones simples (sin tecnicismos) qué impacto tiene el SEO débil en sus ventas/clientes
- Mencionar específicamente los problemas encontrados, pero de forma accesible
- Invitarlos a responder este email para coordinar una consulta sin compromiso
- Cerrar con tu nombre: Mariano Aliandri

Tono: cercano, profesional, nunca agresivo ni spam. En español rioplatense (vos, no tú).
Solo el cuerpo del email, sin asunto ni firma extra. Saltos de línea entre párrafos.`;
      try {
        emailText = await callGemini(prompt);
        source = 'gemini';
      } catch (e) {
        // Gemini caído (ej. API key inválida) → usar la plantilla propia
        console.warn('[send-biz-email] Gemini no disponible, usando plantilla:', e.message);
        emailText = buildTemplateEmail({ nombre, siteUrl, seoScore, ciudad, problemas, nivelSeo });
        source = 'template';
      }
    }

    // Screenshot del sitio web de la empresa (reusar el del preview si vino)
    const screenshotUrl = providedShot !== undefined ? providedShot : await getScreenshot(siteUrl);

    // Modo preview: devolver el texto + screenshot sin enviar nada
    if (preview) {
      return Response.json({ success: true, preview: true, emailText, screenshotUrl, source });
    }

    // Construir HTML del email
    const bodyLines = emailText
      .split('\n')
      .map(l => `<p style="margin:0 0 14px;color:#374151;line-height:1.7;font-size:15px">${l || '&nbsp;'}</p>`)
      .join('');

    const screenshotHtml = screenshotUrl
      ? `<div style="margin:28px 0 8px">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Vista actual de su sitio web</p>
          <div style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
            <a href="${siteUrl}" target="_blank">
              <img src="${screenshotUrl}" alt="${nombre}" style="width:100%;display:block" />
            </a>
          </div>
          ${seoScore != null ? `<p style="margin:8px 0 0;font-size:12px;color:#6b7280;text-align:center">Score SEO actual: <strong style="color:${seoScore >= 70 ? '#10b981' : seoScore >= 40 ? '#f59e0b' : '#ef4444'}">${seoScore}/100</strong></p>` : ''}
         </div>`
      : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:580px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 36px">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px">Análisis de presencia digital</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:20px;font-weight:800">${nombre}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px">
      ${bodyLines}
      ${screenshotHtml}
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px;border-top:1px solid #f3f4f6;background:#fafafa">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        <strong style="color:#4f46e5">Mariano Aliandri</strong> · Desarrollador Full Stack &amp; Analista de Datos<br>
        <a href="${SITE_URL}" style="color:#6366f1;text-decoration:none">${SITE_URL}</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    // Enviar con Resend
    const subject = `Análisis SEO de ${nombre} — oportunidades de mejora`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from:     'Mariano Aliandri <notificaciones@marianoaliandri.com.ar>',
      to:       email,
      reply_to: 'marianoaliandri@gmail.com',
      subject,
      html,
    });

    if (result.error) throw new Error(result.error.message || 'Error de Resend');
    const resendId = result.data?.id || null;

    // Guardar registro del envío en Firestore (no romper el envío si falla)
    try {
      const db = getDb();
      if (db) {
        await db.collection('sent_emails').add({
          nombre, email, siteUrl, ciudad: ciudad || null, tipo: tipo || null,
          seoScore: seoScore ?? null, auditoriaId: auditoriaId || null,
          subject, body: emailText, screenshotUrl: screenshotUrl || null,
          source: source || null, resendId,
          status: 'sent',
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } catch (logErr) {
      console.error('[send-biz-email] no se pudo guardar el registro:', logErr.message);
    }

    return Response.json({ success: true, emailId: resendId, emailText, source });
  } catch (e) {
    console.error('[send-biz-email] ERROR:', e.message, e.stack);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
