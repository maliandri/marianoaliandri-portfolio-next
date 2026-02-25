'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const PaymentPending = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        {/* Icono de pendiente */}
        <div className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 4" />
          </svg>
        </div>

        {/* Título */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Pago Pendiente
        </h1>

        {/* Mensaje */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          Tu pago está siendo procesado. Te notificaremos por email cuando se confirme. 
          Mientras tanto, nos pondremos en contacto contigo para coordinar los detalles del proyecto.
        </p>

        {/* Información del proceso */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-blue-800">
            <strong>¿Qué significa esto?</strong><br/>
            • El pago está en revisión<br/>
            • Puede tardar hasta 48 horas<br/>
            • Te notificaremos del resultado<br/>
            • No necesitas hacer nada más
          </p>
        </div>

        {/* Botones */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Volver al inicio
          </button>
          
          <button
            onClick={() => window.open('mailto:tupaginaweb@marianoaliandri.com.ar?subject=Consulta sobre pago pendiente', '_blank')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Consultar estado
          </button>
        </div>

        {/* Nota adicional */}
        <div className="mt-6 p-3 bg-gray-50 rounded text-sm text-gray-600">
          <strong>Nota:</strong> Los pagos en efectivo (Rapipago, Pago Fácil) 
          pueden tardar más en procesarse.
        </div>
      </div>
    </div>
  );
};

export default PaymentPending;