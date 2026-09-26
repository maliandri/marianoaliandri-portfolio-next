import Link from 'next/link';

export const metadata = {
  title: 'Política de devoluciones | Mariano Aliandri',
  description: 'Política de devoluciones y reembolsos de los productos y servicios digitales de Mariano Aliandri.',
  alternates: { canonical: 'https://marianoaliandri.com.ar/politica-devoluciones/' },
};

const UPDATED = '26 de septiembre de 2026';
const EMAIL   = 'yo@marianoaliandri.com.ar';
const WA      = 'https://wa.me/5492995414422';

export default function PoliticaDevoluciones() {
  return (
    <main className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-16">

        <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3">
          Legal
        </p>
        <h1 className="text-3xl font-black mb-2">Política de devoluciones</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
          Última actualización: {UPDATED}
        </p>

        <Section title="1. Naturaleza del servicio">
          <p>
            Los productos comercializados en este sitio —incluyendo <strong>Lead Finder Pro</strong>,
            la <strong>Analítica Regional</strong> y los planes de suscripción— son{' '}
            <strong>servicios digitales de entrega inmediata</strong>. Una vez que el acceso
            o los créditos se acreditan en la cuenta del usuario, el servicio se considera
            prestado.
          </p>
        </Section>

        <Section title="2. Política general de devoluciones">
          <p>
            Debido a la naturaleza digital e instantánea de los productos, <strong>no se
            aceptan devoluciones ni reembolsos</strong> una vez que los créditos o el
            acceso fueron activados en la cuenta, de acuerdo con el artículo 34 de la
            Ley de Defensa del Consumidor (Ley 24.240) que excluye los bienes y
            servicios digitales de consumo inmediato del derecho de revocación.
          </p>
        </Section>

        <Section title="3. Excepciones">
          <p>Se evaluará el reembolso parcial o total únicamente en los siguientes casos:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-gray-700 dark:text-gray-300">
            <li>
              <strong>Falla técnica comprobable</strong>: el servicio no pudo utilizarse
              por un error del sistema imputable a este sitio y no fue posible resolverlo
              en un plazo razonable (72 horas hábiles).
            </li>
            <li>
              <strong>Cobro duplicado</strong>: se procesó más de un pago por el mismo
              concepto y período.
            </li>
            <li>
              <strong>Créditos no utilizados en cancelación</strong>: si el usuario cancela
              una suscripción activa, los créditos del período en curso no se reembolsan,
              pero el acceso se mantiene hasta el fin del período pago.
            </li>
          </ul>
        </Section>

        <Section title="4. Procedimiento de reclamo">
          <p>
            Para solicitar una excepción, el usuario debe contactarse dentro de los{' '}
            <strong>7 días corridos</strong> de la fecha del pago, indicando:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2 text-gray-700 dark:text-gray-300">
            <li>Nombre completo y dirección de email de la cuenta.</li>
            <li>Fecha y monto del pago.</li>
            <li>Descripción del problema o inconveniente.</li>
          </ul>
          <p className="mt-3">
            El reclamo puede enviarse por email a{' '}
            <a href={`mailto:${EMAIL}`} className="text-indigo-600 dark:text-indigo-400 underline">{EMAIL}</a>
            {' '}o por WhatsApp a{' '}
            <a href={WA} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">+54 9 299 541-4422</a>.
            La respuesta se emitirá dentro de las 48 horas hábiles.
          </p>
        </Section>

        <Section title="5. Suscripciones recurrentes">
          <p>
            Los planes de suscripción mensual (cobrados a través de MercadoPago) pueden
            cancelarse en cualquier momento desde el panel de usuario o contactando a
            soporte. La cancelación detiene la renovación automática; los créditos del
            período en curso permanecen disponibles hasta su vencimiento.
          </p>
        </Section>

        <Section title="6. Cambios en la política">
          <p>
            Esta política puede modificarse en cualquier momento. Los cambios se publicarán
            en esta misma página con la fecha de actualización. El uso continuado del
            servicio implica la aceptación de la versión vigente.
          </p>
        </Section>

        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-neutral-800 text-sm text-gray-500 dark:text-gray-400">
          <p>
            ¿Tenés una consulta?{' '}
            <a href={`mailto:${EMAIL}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">{EMAIL}</a>
            {' '}·{' '}
            <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">Volver al inicio</Link>
          </p>
        </div>

      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed space-y-2">
        {children}
      </div>
    </section>
  );
}
