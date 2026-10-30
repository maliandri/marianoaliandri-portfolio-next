export const dynamic = 'force-dynamic';
import { Resend } from 'resend';
import { requireAdmin } from '@/lib/adminAuth';
import { buildHtml } from '@/lib/presupuestoEmail';


export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
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
