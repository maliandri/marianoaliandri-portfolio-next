'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const PaymentFailure = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        {/* Icono de error */}
        <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        {/* Título */}
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Pago No Procesado
        </h1>

        {/* Mensaje */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          Hubo un problema con tu pago. No te preocupes, no se realizó ningún cargo. 
          Puedes intentar nuevamente o contactarnos directamente.
        </p>

        {/* Posibles motivos */}
        <div className="bg-yellow-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-yellow-800">
            <strong>Posibles motivos:</strong><br/>
            • Fondos insuficientes<br/>
            • Datos de tarjeta incorrectos<br/>
            • Problema temporal del banco<br/>
            • Pago cancelado por el usuario
          </p>
        </div>

        {/* Botones */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Intentar nuevamente
          </button>
          
          <button
            onClick={() => window.open('https://wa.me/5491234567890?text=Hola, tuve un problema con el pago de mi proyecto web', '_blank')}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Contactar por WhatsApp
          </button>

          <button
            onClick={() => window.open('mailto:tupaginaweb@marianoaliandri.com.ar?subject=Problema con pago', '_blank')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Enviar email
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailure;

