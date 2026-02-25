import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = 'yo@marianoaliandri.com.ar';
const FROM_EMAIL = 'Mariano Aliandri <notificaciones@marianoaliandri.com.ar>';

const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

// Template base HTML
function baseTemplate(content, preheader = '') {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notificacion - Mariano Aliandri</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  ${preheader ? `<div style="display:none;font-size:1px;color:#f4f4f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">Mariano Aliandri</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Desarrollo Web & Data Analytics</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                marianoaliandri.com.ar &bull; Este email fue enviado automaticamente
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Badge/chip HTML
function badge(text, color = '#7c3aed') {
  return `<span style="display:inline-block;background-color:${color};color:#ffffff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">${text}</span>`;
}

// Info row HTML
function infoRow(label, value) {
  if (!value) return '';
  return `<tr>
    <td style="padding:8px 0;color:#6b7280;font-size:14px;font-weight:600;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;color:#111827;font-size:14px;">${value}</td>
  </tr>`;
}

// Templates por tipo de formulario
const templates = {
  contact: (data) => ({
    subject: `Nuevo mensaje de contacto de ${data.name}`,
    html: baseTemplate(`
      <div style="margin-bottom:20px;">${badge('Contacto', '#2563eb')}</div>
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Nuevo mensaje de contacto</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Alguien completo el formulario de contacto en tu sitio web.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:16px;">
        ${infoRow('Nombre', data.name)}
        ${infoRow('Email', `<a href="mailto:${data.email}" style="color:#2563eb;text-decoration:none;">${data.email}</a>`)}
      </table>
      <div style="margin-top:20px;padding:16px;background-color:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 4px;color:#166534;font-size:12px;font-weight:600;text-transform:uppercase;">Mensaje</p>
        <p style="margin:0;color:#111827;font-size:14px;line-height:1.6;">${data.message}</p>
      </div>
      <div style="margin-top:24px;text-align:center;">
        <a href="mailto:${data.email}?subject=Re: Consulta desde marianoaliandri.com.ar" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Responder</a>
      </div>
    `, `Nuevo contacto de ${data.name}: ${data.message?.substring(0, 80)}...`),
  }),

  'roi-lead': (data) => {
    let resultsHtml = '';
    if (data.calculationResults) {
      try {
        const results = typeof data.calculationResults === 'string' ? JSON.parse(data.calculationResults) : data.calculationResults;
        const rows = Object.entries(results).map(([key, val]) =>
          `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">${key}</td><td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;">${val}</td></tr>`
        ).join('');
        resultsHtml = `<div style="margin-top:20px;">
          <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Resultados del Calculo</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#faf5ff;border-radius:8px;overflow:hidden;">${rows}</table>
        </div>`;
      } catch (e) {
        resultsHtml = `<div style="margin-top:20px;padding:12px;background-color:#faf5ff;border-radius:8px;">
          <p style="margin:0;color:#6b7280;font-size:13px;">${data.calculationResults}</p>
        </div>`;
      }
    }

    return {
      subject: `Nuevo lead ROI: ${data.name}`,
      html: baseTemplate(`
        <div style="margin-bottom:20px;">${badge('Lead ROI', '#9333ea')}</div>
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Nuevo lead de la calculadora ROI</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Un usuario calculo su ROI y dejo sus datos de contacto.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:16px;">
          ${infoRow('Nombre', data.name)}
          ${infoRow('Email', `<a href="mailto:${data.email}" style="color:#2563eb;text-decoration:none;">${data.email}</a>`)}
          ${infoRow('Telefono', data.phone ? `<a href="https://wa.me/${data.phone.replace(/[^0-9]/g, '')}" style="color:#22c55e;text-decoration:none;">${data.phone}</a>` : '')}
          ${infoRow('Empresa', data.company)}
        </table>
        ${resultsHtml}
        <div style="margin-top:24px;text-align:center;">
          ${data.phone ? `<a href="https://wa.me/${data.phone.replace(/[^0-9]/g, '')}?text=Hola ${data.name}! Soy Mariano Aliandri. Vi tu calculo de ROI y me gustaria charlar sobre como puedo ayudarte." style="display:inline-block;background:#22c55e;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-right:8px;">WhatsApp</a>` : ''}
          <a href="mailto:${data.email}?subject=Tu analisis de ROI - Mariano Aliandri" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Email</a>
        </div>
      `, `Lead ROI de ${data.name} - ${data.company || 'Sin empresa'}`),
    };
  },

  'web-lead': (data) => {
    let resultsHtml = '';
    if (data.calculationResults) {
      try {
        const results = typeof data.calculationResults === 'string' ? JSON.parse(data.calculationResults) : data.calculationResults;
        const rows = Object.entries(results).map(([key, val]) =>
          `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">${key}</td><td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:600;border-bottom:1px solid #f3f4f6;text-align:right;">${val}</td></tr>`
        ).join('');
        resultsHtml = `<div style="margin-top:20px;">
          <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Cotizacion Web</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff;border-radius:8px;overflow:hidden;">${rows}</table>
        </div>`;
      } catch (e) {
        resultsHtml = `<div style="margin-top:20px;padding:12px;background-color:#eff6ff;border-radius:8px;">
          <p style="margin:0;color:#6b7280;font-size:13px;">${data.calculationResults}</p>
        </div>`;
      }
    }

    return {
      subject: `Nuevo lead Web: ${data.name}`,
      html: baseTemplate(`
        <div style="margin-bottom:20px;">${badge('Lead Web', '#2563eb')}</div>
        <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Nuevo lead de la calculadora Web</h2>
        <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Un usuario cotizo su sitio web y dejo sus datos de contacto.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:16px;">
          ${infoRow('Nombre', data.name)}
          ${infoRow('Email', `<a href="mailto:${data.email}" style="color:#2563eb;text-decoration:none;">${data.email}</a>`)}
          ${infoRow('Telefono', data.phone ? `<a href="https://wa.me/${data.phone.replace(/[^0-9]/g, '')}" style="color:#22c55e;text-decoration:none;">${data.phone}</a>` : '')}
        </table>
        ${resultsHtml}
        <div style="margin-top:24px;text-align:center;">
          ${data.phone ? `<a href="https://wa.me/${data.phone.replace(/[^0-9]/g, '')}?text=Hola ${data.name}! Soy Mariano Aliandri. Vi tu cotizacion web y me gustaria conversar sobre tu proyecto." style="display:inline-block;background:#22c55e;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-right:8px;">WhatsApp</a>` : ''}
          <a href="mailto:${data.email}?subject=Tu cotizacion web - Mariano Aliandri" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Email</a>
        </div>
      `, `Lead Web de ${data.name}`),
    };
  },

  welcome: (data) => ({
    subject: `Bienvenido/a ${data.recipientName || ''} - Mariano Aliandri`,
    to: data.to,
    html: baseTemplate(`
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);width:64px;height:64px;border-radius:50%;line-height:64px;font-size:28px;">
          <span style="color:#fff;">&#9733;</span>
        </div>
      </div>
      <h2 style="margin:0 0 8px;color:#111827;font-size:22px;text-align:center;">Bienvenido/a${data.recipientName ? `, ${data.recipientName}` : ''}!</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;text-align:center;">Gracias por registrarte en marianoaliandri.com.ar</p>
      <div style="padding:24px;background-color:#faf5ff;border-radius:12px;border:1px solid #e9d5ff;">
        <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.8;">Hola! Soy Mariano Aliandri, desarrollador web y especialista en Data Analytics.</p>
        <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.8;">Ahora que sos parte de la comunidad, vas a poder:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;color:#374151;font-size:14px;">&#10003; &nbsp;Hacer preguntas sobre los servicios y productos</td></tr>
          <tr><td style="padding:6px 0;color:#374151;font-size:14px;">&#10003; &nbsp;Recibir respuestas personalizadas directamente de mi</td></tr>
          <tr><td style="padding:6px 0;color:#374151;font-size:14px;">&#10003; &nbsp;Acceder a cotizaciones y calculadoras exclusivas</td></tr>
          <tr><td style="padding:6px 0;color:#374151;font-size:14px;">&#10003; &nbsp;Guardar tu perfil profesional</td></tr>
        </table>
        <p style="margin:20px 0 0;color:#374151;font-size:15px;line-height:1.8;">Si tenes alguna consulta o proyecto en mente, no dudes en escribirme. Estoy para ayudarte!</p>
      </div>
      <div style="margin-top:28px;text-align:center;">
        <a href="https://marianoaliandri.com.ar/store" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-right:8px;">Ver Servicios</a>
        <a href="https://wa.me/5492995414422?text=Hola Mariano! Me registre en tu web y me gustaria consultarte sobre..." style="display:inline-block;background:#22c55e;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">WhatsApp</a>
      </div>
      <p style="margin:28px 0 0;color:#9ca3af;font-size:13px;text-align:center;line-height:1.6;">
        Mariano Aliandri<br>
        Desarrollo Web & Data Analytics<br>
        <a href="https://wa.me/5492995414422" style="color:#7c3aed;text-decoration:none;">+54 299 541-4422</a>
      </p>
    `, `Bienvenido/a ${data.recipientName || ''} a marianoaliandri.com.ar`),
  }),

  'chatbot-lead': (data) => ({
    subject: `Lead del Chatbot: ${data.name}`,
    html: baseTemplate(`
      <div style="margin-bottom:20px;">${badge('Chatbot Lead', '#f59e0b')}</div>
      <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Lead capturado por el chatbot</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">El chatbot detecto informacion de contacto durante una conversacion.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;padding:16px;">
        ${infoRow('Nombre', data.name)}
        ${infoRow('Email', data.email ? `<a href="mailto:${data.email}" style="color:#2563eb;text-decoration:none;">${data.email}</a>` : '')}
        ${infoRow('Telefono', data.phone ? `<a href="https://wa.me/${data.phone.replace(/[^0-9]/g, '')}" style="color:#22c55e;text-decoration:none;">${data.phone}</a>` : '')}
      </table>
      ${data.message ? `<div style="margin-top:20px;padding:16px;background-color:#fffbeb;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;">
        <p style="margin:0 0 4px;color:#92400e;font-size:12px;font-weight:600;text-transform:uppercase;">Ultimo mensaje</p>
        <p style="margin:0;color:#111827;font-size:14px;line-height:1.6;">${data.message}</p>
      </div>` : ''}
      ${data.conversation ? `<div style="margin-top:16px;padding:16px;background-color:#f9fafb;border-radius:8px;">
        <p style="margin:0 0 8px;color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;">Resumen de conversacion</p>
        <p style="margin:0;color:#374151;font-size:13px;line-height:1.6;white-space:pre-line;">${data.conversation}</p>
      </div>` : ''}
      <div style="margin-top:24px;text-align:center;">
        ${data.phone ? `<a href="https://wa.me/${data.phone.replace(/[^0-9]/g, '')}?text=Hola ${data.name}! Soy Mariano Aliandri. Vi que estuviste chateando en mi web y me gustaria ayudarte." style="display:inline-block;background:#22c55e;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-right:8px;">WhatsApp</a>` : ''}
        ${data.email ? `<a href="mailto:${data.email}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#2563eb);color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Email</a>` : ''}
      </div>
    `, `Lead del chatbot: ${data.name} - ${data.email || data.phone || ''}`),
  }),
};

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: responseHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: responseHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { type, ...formData } = data;

    if (!type || !templates[type]) {
      return {
        statusCode: 400,
        headers: responseHeaders,
        body: JSON.stringify({ error: `Tipo de formulario invalido: ${type}. Tipos validos: ${Object.keys(templates).join(', ')}` }),
      };
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY no configurada');
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({ error: 'Servicio de email no configurado' }),
      };
    }

    const template = templates[type](formData);

    // Para welcome, enviar al usuario; para el resto, al admin
    const recipient = template.to || ADMIN_EMAIL;
    const toList = Array.isArray(recipient) ? recipient : [recipient];

    console.log(`Enviando email tipo=${type}, from=${FROM_EMAIL}, to=${toList.join(',')}, subject=${template.subject}`);

    const { data: emailResult, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toList,
      subject: template.subject,
      html: template.html,
    });

    if (error) {
      console.error('Error Resend:', JSON.stringify(error));
      return {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({ error: 'Error enviando email', details: error.message, name: error.name, statusCode: error.statusCode }),
      };
    }

    console.log(`Email enviado (${type}):`, emailResult.id);

    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({ success: true, message: 'Email enviado correctamente', id: emailResult.id }),
    };
  } catch (error) {
    console.error('Error en send-email:', error.message, error.stack);
    return {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ error: 'Error interno', details: error.message, stack: error.stack?.split('\n').slice(0, 3) }),
    };
  }
}
