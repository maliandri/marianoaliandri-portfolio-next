export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { getSentEmailCounts } from '@/lib/sentEmailCounts';
import { requireAdmin } from '@/lib/adminAuth';

// Cuántas veces se envió el email de análisis SEO a cada negocio (por email),
// y cuándo fue la última vez. Solo para uso del admin (AuditoriasManager /
// AuditoriasUnificado) — no expone nada nuevo, agrega lo que ya se guarda en
// `sent_emails` cada vez que se manda un mail (ver /api/auditorias/send-biz-email).
export async function GET(request) {
  const { response: noAdmin } = await requireAdmin(request);
  if (noAdmin) return noAdmin;
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });
    const counts = await getSentEmailCounts(db);
    return Response.json(counts);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
