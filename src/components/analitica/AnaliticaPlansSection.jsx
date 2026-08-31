'use client';

import { useState, useEffect } from 'react';
import { PLANS, PAID_PLAN_IDS, formatPlanPrice } from '@/data/plans';
import { useAuthUser } from '@/hooks/useAuthUser';

// Sección pública de planes de Analítica Regional — visible siempre en /analitica, y
// reutilizada en /herramientas. Antes los precios solo aparecían en un modal (PlansModal)
// disparado al agotar la cuota; esto los deja descubribles sin necesidad de gastar la
// búsqueda gratis primero. Trae precio/cuota en vivo desde /api/analitica-plans (lo mismo
// que edita Admin > Planes), no de los defaults estáticos de data/plans.js.
export default function AnaliticaPlansSection({ anchorId = 'planes' }) {
  const { user, login, getIdToken } = useAuthUser();
  const [plans, setPlans] = useState(null);
  const [me, setMe] = useState(null); // plan actual del usuario logueado
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/analitica-plans')
      .then(r => r.json())
      .then(data => setPlans(data.plans || []))
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (!user) { setMe(null); return; }
    getIdToken().then(token => {
      if (!token) return;
      fetch('/api/me/', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(setMe)
        .catch(() => {});
    });
  }, [user, getIdToken]);

  const subscribe = async (planId) => {
    setError('');
    setLoadingPlan(planId);
    try {
      const token = await getIdToken();
      if (!token) { setError('Iniciá sesión de nuevo e intentá otra vez.'); setLoadingPlan(null); return; }
      const res = await fetch('/api/subscribe/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok || !data.initPoint) throw new Error(data.error || 'No se pudo iniciar el pago');
      window.location.href = data.initPoint;
    } catch (e) {
      setError(e.message || 'Error iniciando el pago');
      setLoadingPlan(null);
    }
  };

  if (plans === null) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const order = ['free', ...PAID_PLAN_IDS];
  const currentPlan = me?.plan || null;

  return (
    <div id={anchorId} className="max-w-5xl mx-auto scroll-mt-24">
      <div className="text-center mb-8">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Planes</p>
        <h2 className="text-2xl md:text-3xl font-black text-white">Elegí cuánto querés buscar</h2>
        {!user && (
          <p className="text-gray-500 text-sm mt-2">Registrate gratis — incluye 1 búsqueda sin cargo.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {order.map(id => {
          const live = plans.find(p => p.id === id) || {};
          const def = PLANS[id];
          const price = live.price ?? def.price;
          const limit = live.limit !== undefined ? live.limit : def.limit;
          const isPaid = PAID_PLAN_IDS.includes(id);
          const isCurrent = currentPlan === id;

          return (
            <div
              key={id}
              className={`relative bg-[#111] border rounded-2xl p-6 flex flex-col hover:border-indigo-500/30 transition-colors ${
                def.highlight ? 'border-indigo-500' : 'border-white/10'
              }`}
            >
              {def.highlight && (
                <span className="absolute -top-2.5 left-6 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide">
                  Más elegido
                </span>
              )}
              <h3 className="text-white font-bold text-lg mb-1">{def.name}</h3>
              <div className="mt-1 mb-4">
                <span className="text-2xl font-black text-white">{formatPlanPrice(price)}</span>
                {price > 0 && <span className="text-sm font-normal text-gray-500">/mes</span>}
              </div>
              <p className="text-gray-500 text-xs mb-4">
                {limit === null ? 'Búsquedas ilimitadas' : `${limit} ${limit === 1 ? 'búsqueda' : 'búsquedas'}${id === 'free' ? ' (única)' : '/mes'}`}
              </p>
              <ul className="space-y-2 mb-5 flex-1">
                {def.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-emerald-400 mt-0.5">✓</span> {f}
                  </li>
                ))}
              </ul>

              {!user ? (
                <button onClick={login} className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm">
                  Iniciar sesión para elegir
                </button>
              ) : isCurrent ? (
                <div className="text-center py-2.5 rounded-xl bg-white/5 text-gray-400 text-sm font-medium">Tu plan actual</div>
              ) : isPaid ? (
                <button
                  onClick={() => subscribe(id)}
                  disabled={loadingPlan === id}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
                >
                  {loadingPlan === id ? 'Redirigiendo a MercadoPago...' : 'Elegir este plan →'}
                </button>
              ) : (
                <div className="text-center py-2.5 rounded-xl bg-white/5 text-gray-500 text-sm">Incluido al registrarte</div>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-rose-400 text-center">{error}</p>}
      <p className="mt-5 text-xs text-gray-600 text-center">
        Pagos procesados por MercadoPago. Las suscripciones se renuevan automáticamente cada mes, cancelás cuando quieras.
      </p>
    </div>
  );
}
