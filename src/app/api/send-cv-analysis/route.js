import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

function getScoreColor(score) {
  if (score >= 80) return '#059669';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#dc2626';
}

function generateAnalysisHTML(cvAnalysis, paymentId, amount, timestamp) {
  const results = cvAnalysis.map((r, i) => `
    <div style="background:#f9fafb;border-left:4px solid ${getScoreColor(r.score)};padding:20px;margin:15px 0;border-radius:8px;">
      <h3 style="color:#1f2937;margin:0 0 15px 0;font-size:20px;">${i + 1}. ${r.profesion}</h3>
      <div style="margin-bottom:15px;">
        <div style="display:inline-block;background:${getScoreColor(r.score)};color:white;padding:8px 16px;border-radius:20px;font-weight:bold;font-size:18px;">Score: ${r.score}%</div>
      </div>
      ${r.skills_found?.length > 0 ? `<div style="margin:15px 0;"><strong style="color:#059669;display:block;margin-bottom:8px;">✅ Skills Encontradas:</strong><div style="display:flex;flex-wrap:wrap;gap:8px;">${r.skills_found.map(skill => `<span style="background:#d1fae5;color:#065f46;padding:6px 12px;border-radius:12px;font-size:14px;">${skill}</span>`).join('')}</div></div>` : ''}
      ${r.skills_missing?.length > 0 ? `<div style="margin:15px 0;"><strong style="color:#dc2626;display:block;margin-bottom:8px;">❌ Skills Faltantes:</strong><div style="display:flex;flex-wrap:wrap;gap:8px;">${r.skills_missing.map(skill => `<span style="background:#fee2e2;color:#991b1b;padding:6px 12px;border-radius:12px;font-size:14px;">${skill}</span>`).join('')}</div></div>` : ''}
      ${r.recomendaciones ? `<div style="margin:15px 0;padding:15px;background:white;border-radius:6px;"><strong style="color:#4f46e5;display:block;margin-bottom:8px;">💡 Recomendaciones:</strong><p style="color:#4b5563;margin:0;line-height:1.6;">${r.recomendaciones}</p></div>` : ''}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:800px;margin:0 auto;padding:20px;">
    <div style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:40px 30px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:white;margin:0 0 10px 0;font-size:32px;">🎯 Tu Análisis ATS está Listo</h1>
      <p style="color:rgba(255,255,255,0.9);margin:0;font-size:18px;">Resultados detallados de tu CV profesional</p>
    </div>
    <div style="background:white;padding:40px 30px;border-radius:0 0 12px 12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
      <p style="color:#4b5563;font-size:16px;line-height:1.8;margin:0 0 30px 0;">¡Hola! 👋<br><br>Hemos analizado tu CV contra <strong>${cvAnalysis.length} profesiones</strong>. Aquí están los resultados:</p>
      ${results}
      <div style="margin-top:40px;padding:20px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
        <h3 style="color:#6b7280;margin:0 0 15px 0;font-size:14px;text-transform:uppercase;">Información del Pago</h3>
        <p style="margin:5px 0;color:#4b5563;"><strong>ID:</strong> ${paymentId}</p>
        <p style="margin:5px 0;color:#4b5563;"><strong>Monto:</strong> $${amount} ARS</p>
        <p style="margin:5px 0;color:#4b5563;"><strong>Fecha:</strong> ${new Date(timestamp).toLocaleString('es-AR')}</p>
      </div>
      <div style="text-align:center;margin-top:40px;">
        <a href="https://marianoaliandri.com.ar" style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-decoration:none;padding:15px 40px;border-radius:8px;font-weight:bold;font-size:16px;">Visitar mi Portfolio</a>
      </div>
    </div>
  </div>
</body></html>`;
}

export async function POST(request) {
  try {
    const { email, cvAnalysis, paymentId, amount, timestamp } = await request.json();

    if (!email || !cvAnalysis) {
      return Response.json({ error: 'Faltan datos requeridos: email y cvAnalysis' }, { status: 400 });
    }

    const analysisHTML = generateAnalysisHTML(cvAnalysis, paymentId, amount, timestamp);

    const data = await resend.emails.send({
      from: 'Mariano Aliandri <notificaciones@marianoaliandri.com.ar>',
      to: email,
      subject: '🎯 Tu Análisis ATS está listo - Resultados Detallados',
      html: analysisHTML,
    });

    return Response.json({ success: true, emailId: data.id, message: 'Email enviado correctamente' });
  } catch (error) {
    return Response.json({ error: 'Error enviando email', details: error.message }, { status: 500 });
  }
}
