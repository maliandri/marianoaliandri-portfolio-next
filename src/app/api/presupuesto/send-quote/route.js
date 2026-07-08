export const dynamic = 'force-dynamic';
import { Resend } from 'resend';

const SITE_URL = 'https://marianoaliandri.com.ar';

function fmt(n) {
  return Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHtml({ clientName, clientEmail, clientCompany, items, totals, ivaRate, showIVA, arsRate, notes, quoteNumber, validDays, today, validUntil, cuotas }) {
  const hasDiscount = totals?.hasDiscount;

  const rows = items.map((item, i) => {
    const raw  = parseFloat(item.priceUSD) || 0;
    const disc = parseFloat(item.discount) || 0;
    const net  = raw * (1 - disc / 100);
    const discCell = hasDiscount
      ? `<td style="padding:10px 8px;text-align:center;vertical-align:top;white-space:nowrap;font-size:13px;color:#f59e0b">
           ${disc > 0 ? `-${disc}%` : '—'}
         </td>`
      : '';
    return `
      <tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:10px 8px;color:#9ca3af;font-size:12px;vertical-align:top">${i + 1}</td>
        <td style="padding:10px 8px;vertical-align:top">
          <p style="margin:0;font-weight:600;color:#111827;font-size:14px">${item.label}</p>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:12px">${item.desc}</p>
        </td>
        ${discCell}
        <td style="padding:10px 8px;text-align:right;vertical-align:top;white-space:nowrap">
          ${disc > 0
            ? `<p style="margin:0;font-size:11px;color:#9ca3af;text-decoration:line-through">USD ${fmt(raw)}</p>
               <p style="margin:2px 0 0;font-weight:600;color:#16a34a;font-size:14px">USD ${fmt(net)}</p>`
            : `<p style="margin:0;font-weight:600;color:#111827;font-size:14px">${raw > 0 ? `USD ${fmt(raw)}` : '—'}</p>`
          }
          <p style="margin:2px 0 0;color:#9ca3af;font-size:11px">${net > 0 ? `ARS ${fmt(net * arsRate)}` : ''}</p>
        </td>
      </tr>`;
  }).join('');

  const discountHeader = hasDiscount
    ? `<th style="padding:8px;text-align:center;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">Bonif.</th>`
    : '';

  const bonifRow = hasDiscount
    ? `<tr>
        <td colspan="2" style="padding:8px 8px 4px;text-align:right;color:#f59e0b;font-size:13px">Bonificaciones</td>
        <td style="padding:8px 8px 4px;text-align:right;white-space:nowrap">
          <p style="margin:0;color:#f59e0b;font-weight:500;font-size:13px">- USD ${fmt(totals?.descUSD)}</p>
          <p style="margin:2px 0 0;color:#fcd34d;font-size:11px">- ARS ${fmt(totals?.descARS)}</p>
        </td>
      </tr>`
    : '';

  const ivaRow = showIVA
    ? `<tr>
        <td colspan="2" style="padding:8px 8px 4px;text-align:right;color:#6b7280;font-size:13px">IVA (${ivaRate}%)</td>
        <td style="padding:8px 8px 4px;text-align:right;white-space:nowrap">
          <p style="margin:0;color:#374151;font-weight:500;font-size:13px">USD ${fmt(totals?.ivaUSD)}</p>
          <p style="margin:2px 0 0;color:#9ca3af;font-size:11px">ARS ${fmt(totals?.ivaARS)}</p>
        </td>
      </tr>`
    : '';

  const subtotalLabel = hasDiscount
    ? `<tr>
        <td colspan="2" style="padding:8px 8px 4px;text-align:right;color:#6b7280;font-size:13px">Subtotal bruto</td>
        <td style="padding:8px 8px 4px;text-align:right;white-space:nowrap">
          <p style="margin:0;color:#374151;font-size:13px">USD ${fmt(totals?.brutoUSD)}</p>
        </td>
      </tr>`
    : '';

  const notesSection = notes
    ? `<div style="margin:24px 0;padding:16px;border-left:3px solid #c7d2fe;background:#f5f3ff">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#8b5cf6;text-transform:uppercase;letter-spacing:0.05em">Notas</p>
        <p style="margin:0;font-size:13px;color:#4b5563;white-space:pre-wrap;line-height:1.6">${notes}</p>
      </div>`
    : '';

  const clientSection = (clientName || clientCompany)
    ? `<div style="margin:20px 0 28px;padding:16px;background:#f9fafb;border-radius:8px">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Para</p>
        ${clientName    ? `<p style="margin:0;font-size:15px;font-weight:700;color:#111827">${clientName}</p>` : ''}
        ${clientCompany ? `<p style="margin:2px 0 0;font-size:13px;color:#6b7280">${clientCompany}</p>` : ''}
        ${clientEmail   ? `<p style="margin:2px 0 0;font-size:13px;color:#9ca3af">${clientEmail}</p>` : ''}
      </div>`
    : '';

  const cuotasSection = cuotas
    ? `<div style="margin:24px 0;border:1px solid #e0e7ff;border-radius:10px;overflow:hidden">
        <div style="background:#eef2ff;padding:12px 18px">
          <p style="margin:0;font-weight:700;color:#4338ca;font-size:13px">Plan de pagos — ${cuotas.numCuotas} cuota${cuotas.numCuotas > 1 ? 's' : ''}</p>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f5f7ff">
              <th style="padding:8px 18px;text-align:left;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase">Concepto</th>
              <th style="padding:8px 18px;text-align:right;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;white-space:nowrap">USD</th>
              <th style="padding:8px 18px;text-align:right;font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;white-space:nowrap">ARS</th>
            </tr>
          </thead>
          <tbody>
            ${(cuotas.items || []).map(c => `
              <tr style="border-top:1px solid #e0e7ff">
                <td style="padding:10px 18px;font-size:13px;color:#374151;font-weight:600">${c.label}</td>
                <td style="padding:10px 18px;text-align:right;font-size:13px;font-weight:700;color:#111827;white-space:nowrap">USD ${fmt(c.usd)}</td>
                <td style="padding:10px 18px;text-align:right;font-size:12px;color:#6b7280;white-space:nowrap">ARS ${fmt(c.ars)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:640px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 36px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.6)">Propuesta comercial</p>
          <h1 style="margin:0;font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px">PRESUPUESTO</h1>
          <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">Mariano Aliandri · Desarrollo Web &amp; Datos</p>
        </div>
        <div style="text-align:right">
          <p style="margin:0;font-weight:700;color:#fff;font-size:14px">N° ${quoteNumber}</p>
          <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,0.7)">Fecha: ${today}</p>
          <p style="margin:2px 0 0;font-size:12px;color:rgba(255,255,255,0.7)">Válido hasta: ${validUntil}</p>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px">
      ${clientSection}

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="border-bottom:2px solid #e5e7eb">
            <th style="padding:8px;text-align:left;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;width:24px">#</th>
            <th style="padding:8px;text-align:left;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em">Servicio</th>
            ${discountHeader}
            <th style="padding:8px;text-align:right;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;white-space:nowrap">Precio</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <!-- Totals -->
      <table style="width:100%;border-collapse:collapse;margin-left:auto;max-width:300px">
        <tbody>
          ${subtotalLabel}
          ${bonifRow}
          <tr>
            <td colspan="2" style="padding:8px 8px 4px;text-align:right;color:#6b7280;font-size:13px">Subtotal <small>(sin IVA)</small></td>
            <td style="padding:8px 8px 4px;text-align:right;white-space:nowrap">
              <p style="margin:0;color:#374151;font-weight:600;font-size:13px">USD ${fmt(totals?.netoUSD)}</p>
              <p style="margin:2px 0 0;color:#9ca3af;font-size:11px">ARS ${fmt(totals?.netoARS)}</p>
            </td>
          </tr>
          ${ivaRow}
          <tr style="border-top:2px solid #111827">
            <td colspan="2" style="padding:12px 8px 8px;text-align:right;color:#111827;font-weight:900;font-size:16px">TOTAL</td>
            <td style="padding:12px 8px 8px;text-align:right;white-space:nowrap">
              <p style="margin:0;color:#111827;font-weight:900;font-size:20px">USD ${fmt(totals?.totalUSD)}</p>
              <p style="margin:2px 0 0;color:#6b7280;font-size:13px;font-weight:500">ARS ${fmt(totals?.totalARS)}</p>
            </td>
          </tr>
        </tbody>
      </table>

      ${cuotasSection}
      ${notesSection}

      <!-- Footer -->
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #f3f4f6;text-align:center">
        <p style="margin:0;font-size:12px;color:#6b7280">
          <strong style="color:#4f46e5">Mariano Aliandri</strong> · Desarrollador Full Stack &amp; Analista de Datos
        </p>
        <p style="margin:6px 0 0;font-size:12px;color:#9ca3af">
          <a href="${SITE_URL}" style="color:#6366f1;text-decoration:none">${SITE_URL}</a> · marianoaliandri@gmail.com · +54 299 541-4422
        </p>
        <p style="margin:6px 0 0;font-size:11px;color:#d1d5db">
          Los precios expresados en USD no incluyen IVA · Tipo de cambio referencial: 1 USD = ARS ${Number(arsRate || 1300).toLocaleString('es-AR')}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return Response.json({ error: 'RESEND_API_KEY no configurada' }, { status: 500 });
    }

    const body = await request.json();
    const { clientEmail, quoteNumber, clientName, items = [] } = body;

    if (!clientEmail) return Response.json({ error: 'Email requerido' }, { status: 400 });
    if (!items.length) return Response.json({ error: 'Sin servicios seleccionados' }, { status: 400 });

    const html = buildHtml(body);
    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from:     'Mariano Aliandri <notificaciones@marianoaliandri.com.ar>',
      to:       clientEmail,
      reply_to: 'marianoaliandri@gmail.com',
      subject:  `Presupuesto N° ${quoteNumber}${clientName ? ` — ${clientName}` : ''}`,
      html,
    });

    console.log('[send-quote] enviado a', clientEmail, result.data?.id);
    return Response.json({ success: true, emailId: result.data?.id });
  } catch (e) {
    console.error('[send-quote] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
