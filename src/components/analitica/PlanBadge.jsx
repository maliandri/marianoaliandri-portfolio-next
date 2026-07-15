'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { PLANS } from '@/data/plans';
import PlansModal from '@/components/payments/PlansModal';

// Badge de plan + búsquedas restantes + botón "Ver planes", para el header de Analítica.
// Se autoconsulta /api/me. No renderiza nada si el usuario no está logueado.
export default function PlanBadge() {
  const { user, getIdToken } = useAuthUser();
  const [me, setMe] = useState(null);
  const [showPlans, setShowPlans] = useState(false);

  const loadMe = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch('/api/me/', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setMe(await res.json());
    } catch { /* noop */ }
  }, [getIdToken]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    getIdToken().then((token) => {
      if (!token || !alive) return;
      fetch('/api/me/', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (alive && j) setMe(j); })
        .catch(() => {});
    });
    return () => { alive = false; };
  }, [user, getIdToken]);

  if (!user) return null;

  const planName = me ? (PLANS[me.plan]?.name || 'Gratis') : '…';
  const remaining = me?.remaining;

  return (
    <div className="mt-4 flex items-center gap-3 flex-wrap">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
        <span className="text-indigo-400 font-semibold">Plan {planName}</span>
        {remaining !== undefined && remaining !== null && (
          <span className="text-gray-500">· {remaining} {remaining === 1 ? 'búsqueda' : 'búsquedas'}</span>
        )}
        {remaining === null && <span className="text-emerald-400">· ilimitadas</span>}
      </span>
      {me?.plan !== 'full' && (
        <button
          onClick={() => setShowPlans(true)}
          className="text-xs font-medium text-indigo-400 hover:text-indigo-300"
        >
          Ver planes →
        </button>
      )}

      <PlansModal
        open={showPlans}
        onClose={() => { setShowPlans(false); loadMe(); }}
        getIdToken={getIdToken}
        currentPlan={me?.plan || 'free'}
      />
    </div>
  );
}
