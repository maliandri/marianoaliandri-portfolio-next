export const dynamic = 'force-dynamic';
import admin, { getDb } from '@/lib/firebase-admin';
import { Resend } from 'resend';

// Ver docs/superpowers/specs/2026-09-22-area-cliente-design.md — Sección 3.
const STAGES = ['pago_confirmado', 'en_desarrollo', 'en_revision', 'entregado'];
const STAGE_LABELS = {
  pago_confirmado: 'Pago confirmado',
  en_desarrollo: 'En desarrollo',
  en_revision: 'En revisión',
  entregado: 'Entregado',
};

// Si falla el email, la etapa queda igual actualizada -- no hay nada que "revertir" acá,
// mismo criterio que notifyAdminOfCreditFailure en payment-webhook/route.js.
async function notifyCustomerOfStageChange(orderId, customerEmail, stage, note) {
  try {
    if (!process.env.RESEND_API_KEY || !customerEmail) return;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'Mariano Aliandri <notificaciones@marianoaliandri.com.ar>',
      to: customerEmail,
      reply_to: 'yo@marianoaliandri.com.ar',
      subject: `Tu proyecto pasó a: ${STAGE_LABELS[stage]}`,
      html: `
        <p>Hola,</p>
        <p>Tu proyecto avanzó de etapa: <b>${STAGE_LABELS[stage]}</b>.</p>
        ${note ? `<p>${note}</p>` : ''}
        <p><a href="https://marianoaliandri.com.ar/mis-compras/${orderId}/">Ver el detalle de tu pedido</a></p>
      `,
    });
  } catch (e) {
    console.error('[orders/update-stage] no se pudo enviar el email al cliente:', e.message);
  }
}

export async function POST(request) {
  try {
    const { adminPassword, orderId, stage, note } = await request.json();
    // Se lee acá adentro (no a nivel de módulo) para que el valor real de la env var se
    // evalúe en cada request, mismo motivo que getDb() en payment-webhook/route.js.
    if (!adminPassword || !process.env.ADMIN_PASSWORD || adminPassword !== process.env.ADMIN_PASSWORD) {
      return Response.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (!orderId) return Response.json({ error: 'orderId requerido' }, { status: 400 });
    if (!STAGES.includes(stage)) {
      return Response.json({ error: `stage debe ser uno de: ${STAGES.join(', ')}` }, { status: 400 });
    }

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const ref = db.collection('orders').doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
    const order = snap.data();

    // Solo se puede avanzar (saltar etapas está permitido, retroceder o repetir no).
    const currentIdx = STAGES.indexOf(order.stage || 'pago_confirmado');
    const nextIdx = STAGES.indexOf(stage);
    if (nextIdx <= currentIdx) {
      return Response.json({ error: 'La etapa tiene que ser posterior a la actual' }, { status: 400 });
    }

    // Timestamp.now() (no FieldValue.serverTimestamp()) porque este valor va dentro de un
    // array -- Firestore no permite server timestamps ahí adentro.
    const entry = { stage, at: admin.firestore.Timestamp.now(), note: note || '' };
    await ref.update({
      stage,
      stageHistory: admin.firestore.FieldValue.arrayUnion(entry),
    });

    await notifyCustomerOfStageChange(orderId, order.customerEmail, stage, note);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[orders/update-stage] ERROR:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
