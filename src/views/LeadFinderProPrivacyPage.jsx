'use client';
import React from 'react';
import Link from 'next/link';
import LanguageSwitch from '@/components/leadfinderpro/LanguageSwitch';

export default function LeadFinderProPrivacyPage() {
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
          Política de Privacidad — Lead Finder Pro
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
          Última actualización: septiembre de 2026
        </p>

        <div className="space-y-6 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">1. Qué es Lead Finder Pro</h2>
            <p>
              Lead Finder Pro (disponible en marianoaliandri.com.ar/lead-finder-pro y como app de
              Android) es una herramienta para developers y agencias que audita negocios locales
              (presencia de sitio web, score SEO, datos de contacto) obtenidos de Google Maps /
              Google Places, con fines de prospección de clientes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">2. Datos que recopilamos sobre vos (el titular de la cuenta)</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Datos básicos de perfil (nombre, email, foto) vía Firebase Authentication (login con Google)</li>
              <li>Tu plan y el uso de tus créditos/cuota, para aplicar los límites de tu suscripción</li>
              <li>Tu historial de búsquedas y auditorías dentro de la herramienta</li>
              <li>Estado de pago de nuestro procesador de pagos (MercadoPago en la web, Google Play
                Billing dentro de la app de Android) — nunca vemos ni almacenamos los datos de tu tarjeta</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">3. Datos sobre negocios de terceros (no sobre vos)</h2>
            <p>
              Cuando corrés una auditoría, Lead Finder Pro obtiene información pública de negocios
              desde la API de Google Places (nombre del negocio, dirección, teléfono, rating,
              horarios) y, cuando está publicado, el sitio web/email propio del negocio. Esto{' '}
              <strong>no son datos personales tuyos</strong> — son datos de contacto de negocios
              que estás consultando con fines de prospección, y es tu responsabilidad usarlos
              cumpliendo las leyes de marketing/anti-spam aplicables en el país de esos negocios.
            </p>
            <p className="mt-2">
              Mantenemos un caché por cuenta de los negocios que ya auditaste (para no cobrarte dos
              veces el crédito por el mismo negocio). Este caché está acotado a tu cuenta
              únicamente, en la colección de Firestore <code>leadfinder_client_audits</code>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">4. Cómo usamos tus datos</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>Para autenticarte y aplicar el límite de cuota de tu plan</li>
              <li>Para mostrarte tu propio historial de auditorías</li>
              <li>Para procesar y verificar tus compras de suscripción/créditos</li>
              <li>Para responder pedidos de soporte</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">5. Servicios de terceros que usamos</h2>
            <ul className="list-disc ml-6 space-y-1">
              <li><strong>Firebase (Auth + Firestore)</strong> — autenticación y almacenamiento de datos</li>
              <li><strong>Google Places API</strong> — fuente de los datos de negocios para las auditorías</li>
              <li><strong>MercadoPago</strong> — procesamiento de pagos en el sitio web</li>
              <li><strong>Google Play Billing</strong> — procesamiento de pagos dentro de la app de Android</li>
              <li><strong>Google Gemini</strong> — genera borradores de email de prospección a pedido (sin usar
                datos personales para entrenar modelos de terceros)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">6. Tus derechos</h2>
            <p>Podés solicitar en cualquier momento, escribiéndonos por email:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Acceso a los datos que tenemos sobre tu cuenta</li>
              <li>Eliminación de tu cuenta y todos los datos asociados (entitlements, historial de auditorías)</li>
              <li>Eliminación de un negocio puntual que consultaste, de tu historial personal</li>
            </ul>
            <p className="mt-2">Respondemos dentro de 7 días hábiles y confirmamos cuando la eliminación esté completa.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">7. Uso internacional</h2>
            <p>
              Lead Finder Pro se puede usar para auditar negocios de cualquier país. Los datos se
              almacenan en infraestructura de Google Cloud Platform (Firestore). Si estás en la
              Unión Europea, podés ejercer tus derechos GDPR (acceso, rectificación, eliminación)
              usando el contacto de abajo — esto aplica a los datos de tu propia cuenta; los
              pedidos sobre los datos publicados de un negocio de terceros deberían dirigirse
              generalmente a Google (como fuente de ese dato público) o al negocio en sí.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">8. Contacto</h2>
            <p>Consultas sobre esta política o un pedido de datos:</p>
            <p className="mt-2 font-semibold">yo@marianoaliandri.com.ar</p>
          </section>
        </div>
      </div>
    </div>
  );
}
