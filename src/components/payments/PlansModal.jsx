'use client';

import { useState } from 'react';
import { PLANS, PAID_PLAN_IDS, formatPlanPrice } from '@/data/plans';

// Modal de precios. Se abre desde el 402 (límite alcanzado) o desde un botón "Ver planes".
// `getIdToken` viene del hook useAuthUser (necesario para crear la suscripción).
// `currentPlan` resalta el plan activo.
export default function PlansModal({ open, onClose, getIdToken, currentPlan = 'free' }) {
  const [loadingPlan, setLoading] = useState(null);
  const [error, setError] = useState('');

  if (!open) return null;

  async function subscribe(planId) {
    setLoading(planId);
    setError('');
    try {
      const token = getIdToken ? await getIdToken() : null;
      if (!token) throw new Error('Iniciá sesión para suscribirte');
      const res = await fetch('/api/subscribe/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo iniciar la suscripción');
      window.location.href = json.initPoint; // checkout de MercadoPago
    } catch (e) {
      setError(e.message);
      setLoading(null);
    }
  }

  const order = ['free', ...PAID_PLAN_IDS];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="dark w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0f0f0f] border border-white/10 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-2xl font-black text-white">Elegí tu plan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <p className="text-gray-500 text-sm mb-6">
          Buscá los rubros más buscados en cualquier zona de Argentina. Cancelás cuando quieras.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {order.map((id) => {
            const p = PLANS[id];
            const isCurrent = currentPlan === id;
            const isPaid = PAID_PLAN_IDS.includes(id);
            return (
              <div
                key={id}
                className={`relative rounded-2xl border p-5 flex flex-col ${
                  p.highlight
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : 'border-white/10 bg-white/[0.02]'
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-2.5 left-5 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide">
                    Más elegido
                  </span>
                )}
                <h3 className="text-lg font-bold text-white">{p.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-black text-white">{formatPlanPrice(p.price)}</span>
                  {p.price > 0 && <span className="text-gray-500 text-sm">/mes</span>}
                </div>
                <ul className="space-y-2 mb-5 flex-1">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-emerald-400 mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="text-center py-2 rounded-lg bg-white/5 text-gray-400 text-sm font-medium">
                    Tu plan actual
                  </div>
                ) : isPaid ? (
                  <button
                    onClick={() => subscribe(id)}
                    disabled={loadingPlan === id}
                    className={`py-2.5 rounded-lg font-semibold text-sm transition disabled:opacity-50 ${
                      p.highlight
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {loadingPlan === id ? 'Redirigiendo…' : `Suscribirme`}
                  </button>
                ) : (
                  <div className="text-center py-2 rounded-lg bg-white/5 text-gray-500 text-sm">
                    Al registrarte
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="mt-4 text-sm text-rose-400 text-center">{error}</p>}
        <p className="mt-4 text-xs text-gray-600 text-center">
          Pagos procesados por MercadoPago. La suscripción se renueva automáticamente cada mes.
        </p>
      </div>
    </div>
  );
}
