'use client';

import React, { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const PaymentSuccess = () => {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Opcional: enviar analytics o tracking
    console.log('Payment successful:', searchParams.toString());
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        {/* Icono de éxito */}
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Título */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          ¡Pago Exitoso!
        </h1>

        {/* Mensaje */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          Tu pago ha sido procesado correctamente. Te enviaremos la confirmación por email 
          y nos pondremos en contacto contigo en las próximas 24 horas para comenzar tu proyecto.
        </p>

        {/* Información adicional */}
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-blue-800">
            <strong>Próximos pasos:</strong><br/>
            1. Recibirás un email de confirmación<br/>
            2. Te contactaremos para definir detalles<br/>
            3. Comenzaremos el desarrollo
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
            onClick={() => window.open('mailto:tupaginaweb@marianoaliandri.com.ar', '_blank')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Contactar por email
          </button>
        </div>

        {/* Datos del pago (opcional) */}
        {searchParams.get('payment_id') && (
          <div className="mt-6 p-3 bg-gray-50 rounded text-sm text-gray-600">
            ID de pago: {searchParams.get('payment_id')}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;