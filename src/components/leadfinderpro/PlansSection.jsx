'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebaseservice';
import { useAuthUser } from '@/hooks/useAuthUser';
import { lfpT } from '@/data/i18n/leadFinderPro';

function fmtARS(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);
}

// Nota: los planes siguen en ARS vía MercadoPago incluso en la versión EN — es temporal,
// hasta que el checkout de Gumroad (USD) reemplace este CTA en /en/lead-finder-pro.
function PlanCard({ plan, user, onLogin, getIdToken, t }) {
  const SCOPE_LABEL = {
    localidad: { label: t.scopeLocalidad, className: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' },
    provincia: { label: t.scopeProvincia, className: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
    pais:      { label: t.scopePais,      className: 'bg-red-500/10 text-red-300 border-red-500/20' },
  };
  const scope = SCOPE_LABEL[plan.scope] || SCOPE_LABEL.localidad;
  const isSubscription = plan.billingType !== 'project';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    setError('');
    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) { setError('Iniciá sesión de nuevo e intentá otra vez.'); setLoading(false); return; }
      const res = await fetch('/api/lead-finder-pro/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.initPoint) throw new Error(data.error || 'No se pudo iniciar el pago');
      window.location.href = data.initPoint;
    } catch (e) {
      setError(e.message || 'Error iniciando el pago');
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-6 flex flex-col hover:border-indigo-500/30 transition-colors">
      <span className={`self-start text-[11px] font-medium px-2.5 py-1 rounded-full border mb-3 ${scope.className}`}>
        {scope.label}
      </span>
      <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
      {plan.description && <p className="text-gray-500 text-sm mb-4">{plan.description}</p>}

      <div className="mt-auto">
        <p className="text-2xl font-black text-white">
          {plan.priceARS > 0 ? fmtARS(plan.priceARS) : t.free}
          {plan.priceARS > 0 && (
            <span className="text-sm font-normal text-gray-500">{isSubscription ? t.perMonth : ` ${t.oneTime}`}</span>
          )}
        </p>
        <p className="text-gray-500 text-xs mb-5">{t.creditsIncluded(plan.credits?.toLocaleString('es-AR'))}</p>

        {!user ? (
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            {t.loginToChoose}
          </button>
        ) : (
          <>
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
            >
              {loading ? t.redirecting : t.choosePlan}
            </button>
            {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export default function PlansSection({ anchorId = 'planes', lang = 'es' }) {
  const t = lfpT(lang).plans;
  const toolHref = lang === 'en' ? '/en/lead-finder-pro/buscar' : '/lead-finder-pro/buscar';
  const { user, loading, login, getIdToken } = useAuthUser();
  const [plans, setPlans] = useState(null);
  const [access, setAccess] = useState(null); // null = sin chequear, o { comped, hasCredits }

  useEffect(() => {
    fetch('/api/leadfinder-plans')
      .then(r => r.json())
      .then(data => setPlans(data.plans || []))
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (!user) { setAccess(null); return; }
    getDoc(doc(db, 'leadfinder_entitlements', user.uid))
      .then(snap => {
        const e = snap.data();
        if (!e) return setAccess(null);
        const comped = e.unlimited === true && e.status === 'active';
        const activeSub = e.billingType === 'subscription' && e.status === 'active' && e.planCredits > 0;
        const hasCredits = (e.credits || 0) > 0;
        setAccess(comped || activeSub || hasCredits ? { comped, activeSub, hasCredits } : null);
      })
      .catch(() => setAccess(null));
  }, [user]);
  const hasFreeAccess = access?.comped === true;

  if (plans === null) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center py-12 mb-16">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (plans.length === 0) return null;

  return (
    <div id={anchorId} className="max-w-5xl mx-auto mb-16 scroll-mt-24">
      <div className="text-center mb-8">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">{t.eyebrow}</p>
        <h2 className="text-2xl md:text-3xl font-black text-white">{t.title}</h2>
        {!user && !loading && (
          <p className="text-gray-500 text-sm mt-2">{t.registerHint}</p>
        )}
      </div>

      {hasFreeAccess ? (
        <div className="max-w-xl mx-auto bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6 text-center">
          <p className="text-white font-bold text-lg mb-1">{t.compedTitle}</p>
          <p className="text-gray-400 text-sm mb-5">{t.compedDesc}</p>
          <a href={toolHref} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
            {t.openTool}
          </a>
        </div>
      ) : access ? (
        <div className="max-w-xl mx-auto bg-green-600/10 border border-green-500/20 rounded-2xl p-6 text-center">
          <p className="text-white font-bold text-lg mb-1">{t.activeTitle}</p>
          <p className="text-gray-400 text-sm mb-5">{t.activeDesc}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <a href={toolHref} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
              {t.openTool}
            </a>
            <a href="/mi-cuenta" className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
              {t.myAccount}
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map(plan => (
            <PlanCard key={plan.id} plan={plan} user={user} onLogin={login} getIdToken={getIdToken} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
