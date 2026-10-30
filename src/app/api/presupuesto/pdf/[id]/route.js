export const dynamic = 'force-dynamic';
import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@/lib/firebase-admin';
import { datosPresupuesto } from '@/lib/presupuestoEmail';
import { generarPdfPresupuesto, pdfNombre } from '@/lib/presupuestoPdf';

// PDF público de un presupuesto: solo con el token aleatorio guardado en el doc (`pdfToken`), que se
// crea cuando el admin o el MCP piden el link. Sin token o con uno que no coincide → 404.
const igual = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

export async function GET(request, { params }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get('t');
  const db = getDb();
  if (!db || !token || !id) return new Response('No encontrado', { status: 404 });
  const snap = await db.collection('presupuestos').doc(id).get();
  const d = snap.exists ? snap.data() : null;
  if (!d || !igual(d.pdfToken, token)) return new Response('No encontrado', { status: 404 });
  const datos = datosPresupuesto(id, d);
  if (!datos) return new Response('Este presupuesto todavía no tiene monto', { status: 404 });
  const bytes = await generarPdfPresupuesto(datos);
  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${pdfNombre(datos)}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
