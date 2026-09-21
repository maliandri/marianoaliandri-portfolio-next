'use client';
import React from 'react';
import Link from 'next/link';
import LanguageSwitch from '@/components/leadfinderpro/LanguageSwitch';

export default function LeadFinderProTermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 pb-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-6">
          <Link href="/lead-finder-pro" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm inline-block">
            &larr; Volver a Lead Finder Pro
          </Link>
          <LanguageSwitch />
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Términos de Servicio — Lead Finder Pro
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Última actualización: septiembre de 2026
        </p>

        <div className="space-y-6 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">1. Aceptación</h2>
            <p>
              Al crear una cuenta o usar Lead Finder Pro (en marianoaliandri.com.ar/lead-finder-pro
              o la app de Android), aceptás estos Términos. Proveedor: Mariano Aliandri, Neuquén,
              Argentina. Contacto: yo@marianoaliandri.com.ar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">2. El servicio</h2>
            <p>
              Lead Finder Pro te permite buscar negocios locales por zona y auditarlos (presencia
              de sitio web, score SEO, datos de contacto) usando datos de Google Places. Antes de
              cada búsqueda elegís cuántos resultados querés — esa cantidad consume esa misma
              cantidad de créditos de tu plan. Si un negocio ya lo habías auditado antes, no vuelve
              a consumir un crédito.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">3. Uso aceptable</h2>
            <p>Te comprometés a no:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Usar los datos de negocios auditados para enviar mensajes masivos no solicitados
                en violación de las leyes anti-spam aplicables en el país del destinatario</li>
              <li>Revender o redistribuir los datos crudos de auditoría como un dataset/base de
                datos independiente</li>
              <li>Intentar evadir los límites de crédito, scrapear el servicio en sí, o automatizar
                pedidos fuera del uso previsto de la UI/API</li>
              <li>Usar el servicio para cualquier propósito ilícito</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">4. Planes, créditos y facturación</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Hay planes gratuitos, de suscripción (renovación mensual de créditos) y de pack de
                créditos de pago único; los precios vigentes se muestran en la app</li>
              <li>En el sitio web, el pago lo procesa MercadoPago; dentro de la app de Android, lo
                procesa Google Play Billing. Nunca almacenamos los datos de tu tarjeta</li>
              <li>Las suscripciones se renuevan automáticamente cada mes salvo que se cancelen antes
                de la fecha de renovación, a través del procesador de pago usado (cuenta de
                MercadoPago o suscripciones de Google Play)</li>
              <li>Los créditos no usados de compras de pago único no expiran; los créditos de
                suscripción mensual se reinician cada período de facturación y no se acumulan</li>
              <li>Los reembolsos se evalúan caso por caso contactándonos, y están sujetos además a
                la política de reembolso del procesador de pago usado (MercadoPago o Google Play)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">5. Precisión de los datos</h2>
            <p>
              Los datos de negocios provienen de Google Places y de chequeos automáticos de SEO.
              No garantizamos su precisión, integridad, ni que los datos de contacto de un negocio
              estén actualizados. Verificalos antes de usarlos comercialmente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">6. Disponibilidad y cambios</h2>
            <p>
              El servicio se ofrece &quot;tal cual&quot;. Podemos modificar, suspender o discontinuar
              funcionalidades, o ajustar precios/límites de crédito de los planes, en cualquier
              momento; los cambios importantes a planes pagos no reducirán retroactivamente los
              créditos que ya compraste.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">7. Limitación de responsabilidad</h2>
            <p>
              No somos responsables por daños indirectos o consecuentes derivados del uso del
              servicio, ni de decisiones tomadas en base a los datos de auditoría provistos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">8. Terminación</h2>
            <p>
              Podemos suspender o dar de baja cuentas que violen la Sección 3 (Uso aceptable). Podés
              cerrar tu cuenta en cualquier momento contactándonos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">9. Privacidad</h2>
            <p>
              El tratamiento de datos está descripto en nuestra{' '}
              <Link href="/lead-finder-pro/privacy" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Política de Privacidad
              </Link>, que forma parte de estos Términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">10. Ley aplicable</h2>
            <p>Estos Términos se rigen por las leyes de Argentina, jurisdicción Neuquén, Argentina.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">11. Contacto</h2>
            <p className="font-semibold">yo@marianoaliandri.com.ar</p>
          </section>
        </div>
      </div>
    </div>
  );
}
