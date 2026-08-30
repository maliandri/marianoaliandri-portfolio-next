export const dynamic = 'force-dynamic';

import { getUserFromRequest } from '@/lib/authServer';
import { getDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { POST as leadFinderPost } from '../../lead-finder/route';

// Acciones que solo buscan/listan negocios (sin pedir website/detalle) — no consumen
// créditos, igual que "buscar y explorar" es gratis según lo que le prometimos al dev
// en la landing. La única acción que gasta 1 crédito es 'auditPlace' (website + SEO).
const FREE_ACTIONS = ['geocode', 'searchNearby', 'searchText'];
const PAID_ACTION = 'auditPlace';

export async function POST(request) {
  const authUser = await getUserFromRequest(request);
  if (!authUser) return Response.json({ ok: false, error: 'No autenticado' }, { status: 401 });

  let body;
  try { body = await request.json(); } catch { return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 }); }
  const { action } = body;

  if (action !== PAID_ACTION && !FREE_ACTIONS.includes(action)) {
    return Response.json({ ok: false, error: 'Acción no permitida' }, { status: 400 });
  }

  if (action === PAID_ACTION) {
    const db = getDb();
    if (!db) return Response.json({ ok: false, error: 'DB no disponible' }, { status: 500 });

    const ref = db.collection('leadfinder_entitlements').doc(authUser.uid);
    const gate = await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const e = snap.exists ? snap.data() : null;

      // Hoy solo existe acceso "comped" (otorgado a mano desde el admin) — el checkout
      // con créditos comprables todavía no está construido. Sin unlimited, no hay acceso.
      if (!e || e.unlimited !== true || e.status !== 'active') {
        return { allowed: false };
      }
      tx.set(ref, { auditCount: FieldValue.increment(1), lastAuditAt: FieldValue.serverTimestamp() }, { merge: true });
      return { allowed: true };
    });

    if (!gate.allowed) {
      return Response.json({
        ok: false,
        error: 'No tenés un plan activo de Lead Finder Pro. Elegí un plan para auditar negocios.',
        code: 'NO_PLAN',
      }, { status: 402 });
    }
  }

  // Reusa la misma lógica de /api/lead-finder (Places API + auditoría SEO + caché) —
  // ya autenticado y con el crédito descontado, solo falta ejecutar la acción.
  // OJO: headers armados a mano (no copiar request.headers tal cual) — el Content-Length
  // original corresponde al body crudo de ESTE request, no al JSON re-serializado abajo.
  const forwarded = new Request(request.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: request.headers.get('authorization') || '' },
    body: JSON.stringify(body),
  });
  return leadFinderPost(forwarded);
}
