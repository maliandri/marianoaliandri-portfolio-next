export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { getDb } from '@/lib/firebase-admin';

// Mapa evento de Resend → estado que guardamos
const EVENT_STATUS = {
  'email.sent':      'sent',
  'email.delivered': 'delivered',
  'email.opened':    'opened',
  'email.clicked':   'clicked',
  'email.bounced':   'bounced',
  'email.complained':'complained',
};

// Ranking para no "retroceder" el estado (un delivered tardío no pisa un opened)
const RANK = { sent: 0, delivered: 1, opened: 2, clicked: 3 };
const FORCE = new Set(['bounced', 'complained']); // negativos: siempre se aplican

// Verificación de firma Svix (la que usa Resend). Opcional: si no hay secret, se saltea.
function verifySignature(secret, headers, payload) {
  if (!secret) return true; // sin secret configurado, no verificamos
  try {
    const id = headers.get('svix-id');
    const timestamp = headers.get('svix-timestamp');
    const sigHeader = headers.get('svix-signature');
    if (!id || !timestamp || !sigHeader) return false;

    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const signedContent = `${id}.${timestamp}.${payload}`;
    const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');

    // El header puede traer varias firmas "v1,xxx v1,yyy"
    return sigHeader.split(' ').some(part => {
      const sig = part.includes(',') ? part.split(',')[1] : part;
      try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
      } catch { return false; }
    });
  } catch {
    return false;
  }
}

export async function POST(request) {
  try {
    const raw = await request.text();

    if (!verifySignature(process.env.RESEND_WEBHOOK_SECRET, request.headers, raw)) {
      return Response.json({ error: 'Firma inválida' }, { status: 401 });
    }

    const event = JSON.parse(raw);
    const status = EVENT_STATUS[event?.type];
    const emailId = event?.data?.email_id;
    if (!status || !emailId) return Response.json({ ok: true, ignored: true });

    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    // Buscar el registro por el id de Resend
    const snap = await db.collection('sent_emails').where('resendId', '==', emailId).limit(1).get();
    if (snap.empty) return Response.json({ ok: true, notFound: true });

    const doc = snap.docs[0];
    const current = doc.data().status || 'sent';

    // Solo avanzar el estado (salvo bounced/complained que siempre se aplican)
    const shouldUpdate = FORCE.has(status) || (RANK[status] ?? 0) > (RANK[current] ?? -1);
    if (shouldUpdate) {
      await doc.ref.update({ status, statusUpdatedAt: new Date().toISOString() });
    }

    return Response.json({ ok: true, status });
  } catch (e) {
    console.error('[resend-webhook] ERROR:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
