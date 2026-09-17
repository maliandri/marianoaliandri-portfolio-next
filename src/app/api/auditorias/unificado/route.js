export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-admin';
import { getSentEmailCounts } from '@/lib/sentEmailCounts';

// Vista consolidada, solo para el admin: aplana los `results[]` de todos los
// reportes de la colección `auditorias` en una sola lista de negocios, cada uno
// con la fecha y el título del reporte del que viene, y cuántas veces se le
// mandó el email de análisis SEO (colección `sent_emails`). No se usa para nada
// público — el listado y detalle públicos siguen siendo /auditorias y
// /auditorias/[id], que no cambian.
export async function GET() {
  try {
    const db = getDb();
    if (!db) return Response.json({ error: 'DB no disponible' }, { status: 500 });

    const [auditoriasSnap, emailCounts] = await Promise.all([
      db.collection('auditorias').orderBy('publishedAt', 'desc').get(),
      getSentEmailCounts(db),
    ]);

    const negocios = [];
    auditoriasSnap.forEach(doc => {
      const data = doc.data();
      const publishedAt = data.publishedAt?.toDate?.()?.toISOString()
        || data.createdAt?.toDate?.()?.toISOString()
        || null;

      (data.results || []).forEach(r => {
        const email  = (r.email || '').toLowerCase().trim();
        const counts = email ? emailCounts[email] : null;
        negocios.push({
          ...r,
          reportId:        doc.id,
          reportTitle:     data.title || null,
          publishedAt,
          emailsSentCount: counts?.count || 0,
          lastEmailSentAt: counts?.lastSentAt || null,
        });
      });
    });

    return Response.json(negocios);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
