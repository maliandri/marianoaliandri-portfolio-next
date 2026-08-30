'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebaseservice';
import { useAuthUser } from '@/hooks/useAuthUser';

const SCOPE_LABEL = {
  localidad: { label: '📍 Localidad', className: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' },
  provincia: { label: '🗺️ Provincia', className: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  pais:      { label: '🇦🇷 País',     className: 'bg-red-500/10 text-red-300 border-red-500/20' },
};

const WHATSAPP = '5492995414422';

function fmtARS(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n || 0);
}

function PlanCard({ plan, user, onLogin }) {
  const scope = SCOPE_LABEL[plan.scope] || SCOPE_LABEL.localidad;
  const isSubscription = plan.billingType !== 'project';
  const waMessage = `Hola Mariano, quiero el plan "${plan.name}" de Lead Finder Pro (${fmtARS(plan.priceARS)}${isSubscription ? '/mes' : ''}).`;
  const waLink = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-6 flex flex-col hover:border-indigo-500/30 transition-colors">
      <span className={`self-start text-[11px] font-medium px-2.5 py-1 rounded-full border mb-3 ${scope.className}`}>
        {scope.label}
      </span>
      <h3 className="text-white font-bold text-lg mb-1">{plan.name}</h3>
      {plan.description && <p className="text-gray-500 text-sm mb-4">{plan.description}</p>}

      <div className="mt-auto">
        <p className="text-2xl font-black text-white">
          {plan.priceARS > 0 ? fmtARS(plan.priceARS) : 'Gratis'}
          {plan.priceARS > 0 && (
            <span className="text-sm font-normal text-gray-500">{isSubscription ? '/mes' : ' — pago único'}</span>
          )}
        </p>
        <p className="text-gray-500 text-xs mb-5">{plan.credits?.toLocaleString('es-AR')} auditorías incluidas</p>

        {!user ? (
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            Iniciar sesión para elegir
          </button>
        ) : (
          <a
            href={waLink}
            target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
          >
            Quiero este plan →
          </a>
        )}
      </div>
    </div>
  );
}

export default function PlansSection() {
  const { user, loading, login } = useAuthUser();
  const [plans, setPlans] = useState(null);
  const [hasFreeAccess, setHasFreeAccess] = useState(false);

  useEffect(() => {
    fetch('/api/leadfinder-plans')
      .then(r => r.json())
      .then(data => setPlans(data.plans || []))
      .catch(() => setPlans([]));
  }, []);

  useEffect(() => {
    if (!user) { setHasFreeAccess(false); return; }
    getDoc(doc(db, 'leadfinder_entitlements', user.uid))
      .then(snap => setHasFreeAccess(!!snap.data()?.unlimited))
      .catch(() => setHasFreeAccess(false));
  }, [user]);

  if (plans === null) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center py-12 mb-16">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (plans.length === 0) return null;

  return (
    <div id="planes" className="max-w-5xl mx-auto mb-16 scroll-mt-24">
      <div className="text-center mb-8">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Planes</p>
        <h2 className="text-2xl md:text-3xl font-black text-white">Elegí tu alcance</h2>
        {!user && !loading && (
          <p className="text-gray-500 text-sm mt-2">Registrate gratis para elegir un plan.</p>
        )}
      </div>

      {hasFreeAccess ? (
        <div className="max-w-xl mx-auto bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6 text-center">
          <p className="text-white font-bold text-lg mb-1">🎁 Tenés acceso gratuito a Lead Finder Pro</p>
          <p className="text-gray-400 text-sm mb-5">Ya podés usar la herramienta sin pagar ningún plan — cortesía habilitada por el equipo.</p>
          <a href="/lead-finder-pro/buscar" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
            Abrir herramienta →
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map(plan => (
            <PlanCard key={plan.id} plan={plan} user={user} onLogin={login} />
          ))}
        </div>
      )}
    </div>
  );
}
