'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function BajaClient() {
  const params = useSearchParams();
  const e = params.get('e') || '';
  const t = params.get('t') || '';
  const [estado, setEstado] = useState('inicio'); // inicio | enviando | listo | error

  const confirmar = async () => {
    setEstado('enviando');
    try {
      const res = await fetch('/api/email-baja/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ e, t }),
      });
      setEstado(res.ok ? 'listo' : 'error');
    } catch {
      setEstado('error');
    }
  };

  return (
    <div className="max-w-md text-center">
      {estado === 'listo' ? (
        <>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-3">Listo, no te escribo más</h1>
          <p className="text-gray-600 dark:text-gray-400">Quedó registrada la baja de <strong>{e}</strong>. Perdón por la molestia.</p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-200 mb-3">¿Dejar de recibir mails?</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No le voy a volver a escribir a <strong>{e || 'esta dirección'}</strong> ni a otras casillas de la misma web.
          </p>
          <button
            onClick={confirmar}
            disabled={!e || !t || estado === 'enviando'}
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {estado === 'enviando' ? 'Guardando…' : 'Confirmar baja'}
          </button>
          {estado === 'error' && (
            <p className="mt-4 text-sm text-red-600">El link no es válido o venció. Respondé el mail y te saco a mano.</p>
          )}
        </>
      )}
    </div>
  );
}
