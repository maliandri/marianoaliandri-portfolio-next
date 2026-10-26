export const dynamic = 'force-dynamic';

import { getDb } from '@/lib/firebase-admin';
import { addBaja, verifyUnsubscribe } from '@/lib/emailGuards';

// Confirmación de la página /baja/: { e: email, t: firma HMAC del link del mail }.
// Pública a propósito (la abre quien recibió el mail); la firma impide dar de baja a terceros.
export async function POST(request) {
  const { e, t } = await request.json().catch(() => ({}));
  const email = typeof e === 'string' ? e.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !verifyUnsubscribe(email, t)) {
    return Response.json({ ok: false, error: 'Link inválido' }, { status: 400 });
  }
  const db = getDb();
  if (!db) return Response.json({ ok: false, error: 'No disponible' }, { status: 500 });
  await addBaja(db, email);
  return Response.json({ ok: true });
}
