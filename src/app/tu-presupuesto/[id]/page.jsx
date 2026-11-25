import { notFound } from 'next/navigation';
import { getDb } from '@/lib/firebase-admin';
import { tokenOk, vistaCliente } from '@/lib/presupuestoCliente';
import { pdfUrl } from '@/lib/presupuestoPdf';
import { display, mono } from '@/components/iaPara/fonts';
import { MedirVista, BotonPagar } from './Medir';

// Presupuesto ya charlado, para el cliente (venta por consulta, 2026-11-25). Privado: exige ?t=<pdfToken>; sin token
// o con uno incorrecto → 404 (nunca datos ni error). Sin login: lo abre desde el WhatsApp o el mail que le mandó Mariano.
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tu presupuesto', robots: { index: false, follow: false } };

const ars = (n) => `$ ${Math.round(Number(n) || 0).toLocaleString('es-AR')}`;
const usd = (n) => `US$ ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
const WA = '5492995414422';

export default async function TuPresupuesto({ params, searchParams }) {
  const { id } = await params;
  const { t } = await searchParams;
  const db = getDb();
  if (!db || !id) notFound();
  const snap = await db.collection('presupuestos').doc(String(id)).get().catch(() => null);
  if (!snap?.exists) notFound();
  const d = snap.data();
  if (!tokenOk(typeof t === 'string' ? t : '', d.pdfToken)) notFound();

  const v = vistaCliente(id, d);
  const duda = `https://wa.me/${WA}?text=${encodeURIComponent(`Hola Mariano, tengo una duda del presupuesto ${v.numero}.`)}`;

  return (
    <main className={`min-h-screen bg-page pt-28 pb-20 px-4 ${display.variable} ${mono.variable}`}>
      <MedirVista id={id} />
      <article className="max-w-xl mx-auto">
        <p className="font-[family-name:var(--font-ia-mono)] text-xs uppercase tracking-[0.2em] text-fg-500">Presupuesto N° {v.numero}</p>
        <h1 className="mt-3 font-[family-name:var(--font-ia-display)] text-4xl font-extrabold text-fg">Hola{v.nombre ? ` ${v.nombre}` : ''} 👋</h1>
        <p className="mt-3 text-lg text-fg-400">Este es el presupuesto, tal cual lo charlamos.</p>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-500 mb-3">Lo que vamos a hacer</h2>
          <ul className="space-y-3">
            {v.items.map((it, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-fg/10 bg-card px-4 py-3">
                <span className="mt-0.5 text-accent-primary" aria-hidden>✓</span>
                <span>
                  <span className="block font-semibold text-fg">{it.titulo}</span>
                  {it.beneficio && <span className="block text-sm text-fg-400 mt-0.5">{it.beneficio}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {v.totalARS != null && (
          <section className="mt-8 rounded-2xl border border-fg/15 bg-card px-5 py-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold text-fg">Total</span>
              <span className="font-[family-name:var(--font-ia-mono)] text-2xl font-bold text-fg tabular-nums">{ars(v.totalARS)}</span>
            </div>
            {v.totalUSD != null && <p className="text-right text-xs text-fg-500 mt-1">{usd(v.totalUSD)}</p>}
          </section>
        )}

        <div className="mt-8 flex flex-col gap-3">
          {v.pagado ? (
            <p className="rounded-xl bg-emerald-600/10 border border-emerald-500/30 px-4 py-3 text-emerald-700 dark:text-emerald-300 font-semibold text-center">¡Recibimos tu pago! Ya arrancamos.</p>
          ) : v.linkPago ? (
            <BotonPagar href={v.linkPago} id={id} className="rounded-xl bg-accent-primary text-white text-center font-semibold py-3.5 hover:opacity-90">Pagar con MercadoPago</BotonPagar>
          ) : null}
          <a href={duda} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-fg/20 text-fg text-center font-semibold py-3 hover:border-fg/40">Tengo una duda (WhatsApp)</a>
          <a href={pdfUrl(id, d.pdfToken)} className="text-center text-sm text-fg-500 underline underline-offset-2">Descargar en PDF</a>
        </div>
      </article>
    </main>
  );
}
