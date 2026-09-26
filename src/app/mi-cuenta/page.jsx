'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/utils/firebaseservice';
import AuthGate from '@/components/auth/AuthGate';
import ClientAreaShell from '@/components/ClientAreaShell';
import { useAuthUser } from '@/hooks/useAuthUser';
import { PLANS } from '@/data/plans';

function LeadFinderProCard({ user }) {
  const [entitlement, setEntitlement] = useState(undefined); // undefined = cargando, null = sin acceso

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, 'leadfinder_entitlements', user.uid))
      .then(snap => setEntitlement(snap.exists() ? snap.data() : null))
      .catch(() => setEntitlement(null));
  }, [user]);

  const comped = entitlement?.unlimited === true && entitlement?.status === 'active';
  const activeSub = entitlement?.billingType === 'subscription' && entitlement?.status === 'active' && entitlement?.planCredits > 0;
  const hasCredits = (entitlement?.credits || 0) > 0;
  const hasAccess = comped || activeSub || hasCredits;

  const monthKey = new Date().toISOString().slice(0, 7);
  const subUsed = entitlement?.usagePeriod === monthKey ? (entitlement?.usageCount || 0) : 0;
  const subRemaining = activeSub ? Math.max(0, entitlement.planCredits - subUsed) : null;

  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-1">Producto</p>
          <h3 className="text-white font-bold text-lg">🎯 Lead Finder Pro</h3>
        </div>
        {entitlement === undefined ? (
          <span className="text-xs text-gray-500">Cargando...</span>
        ) : hasAccess ? (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-400">
            {comped ? '🎁 Acceso gratuito' : '✅ Plan activo'}
          </span>
        ) : (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-500/10 text-gray-400">Sin plan</span>
        )}
      </div>

      {hasAccess ? (
        <>
          <p className="text-gray-400 text-sm mb-4">
            {entitlement.auditCount || 0} negocios auditados hasta ahora.
            {activeSub && ` ${subRemaining} de ${entitlement.planCredits} auditorías este mes.`}
            {!activeSub && hasCredits && ` ${entitlement.credits} créditos disponibles.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/lead-finder-pro/buscar" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
              🔍 Buscar negocios
            </Link>
            <Link href="/lead-finder-pro/demo" className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors">
              👀 Ver demo
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className="text-gray-400 text-sm mb-4">
            Todavía no tenés un plan activo. Mirá una auditoría real gratis, o elegí un plan para empezar a buscar negocios en tu zona.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/lead-finder-pro/demo" className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors">
              👀 Ver demo gratis
            </Link>
            <Link href="/lead-finder-pro#planes" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
              Ver planes →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function RubrosBuscadosCard({ user, getIdToken }) {
  const [me, setMe] = useState(undefined);

  useEffect(() => {
    if (!user) return;
    getIdToken().then(token => {
      if (!token) return setMe(null);
      fetch('/api/me/', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(setMe)
        .catch(() => setMe(null));
    });
  }, [user, getIdToken]);

  const planName = me ? (PLANS[me.plan]?.name || 'Gratis') : '…';
  const isPaid = me?.plan && me.plan !== 'free';
  const exhausted = me && me.remaining === 0;

  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-1">Producto</p>
          <h3 className="text-white font-bold text-lg">🔍 Rubros más buscados</h3>
        </div>
        {me === undefined ? (
          <span className="text-xs text-gray-500">Cargando...</span>
        ) : (
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isPaid ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
            {isPaid ? `Plan ${planName}` : 'Plan Gratis'}
          </span>
        )}
      </div>

      <p className="text-gray-400 text-sm mb-4">
        {me?.remaining == null
          ? 'Búsquedas de rubros ilimitadas.'
          : exhausted
          ? 'Ya usaste tu búsqueda gratis del plan actual.'
          : `${me?.remaining ?? '—'} ${me?.remaining === 1 ? 'búsqueda disponible' : 'búsquedas disponibles'}.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/analitica" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
          🔍 Buscar rubros
        </Link>
        {!isPaid && (
          <Link href="/analitica" className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors">
            Ver planes →
          </Link>
        )}
      </div>
    </div>
  );
}

function AnaliticaRegionalCard() {
  return (
    <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-1">Producto</p>
          <h3 className="text-white font-bold text-lg">🗺️ Analítica Regional</h3>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/10 text-green-400">
          Incluido
        </span>
      </div>

      <p className="text-gray-400 text-sm mb-4">
        Analizá zonas urbanas: heatmap de tráfico, concentración de negocios y demanda por barrio en tu ciudad.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/analitica?tab=zona" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors">
          🗺️ Abrir mapa
        </Link>
        <Link href="/analitica?tab=tendencias" className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors">
          📈 Tendencias →
        </Link>
      </div>
    </div>
  );
}

function MiCuentaContent() {
  const { user, getIdToken } = useAuthUser();

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="flex items-center gap-4 mb-8">
        {user?.photoURL && <img src={user.photoURL} alt="" className="w-14 h-14 rounded-full" referrerPolicy="no-referrer" />}
        <div>
          <h1 className="text-2xl font-black text-white">Hola, {user?.displayName?.split(' ')[0] || 'de nuevo'}</h1>
          <p className="text-gray-500 text-sm">{user?.email}</p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="flex flex-wrap gap-2 mb-10">
        <Link href="/lead-finder-pro/buscar" className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors">
          🎯 Buscar negocios
        </Link>
        <Link href="/analitica" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors border border-white/10">
          🔍 Rubros buscados
        </Link>
        <Link href="/analitica?tab=zona" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-colors border border-white/10">
          🗺️ Analítica zonal
        </Link>
      </div>

      <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-4">Tus productos</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <LeadFinderProCard user={user} />
        <RubrosBuscadosCard user={user} getIdToken={getIdToken} />
        <AnaliticaRegionalCard />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/perfil" className="text-gray-500 hover:text-gray-300 transition-colors">Editar mi perfil →</Link>
        <Link href="/mis-compras" className="text-gray-500 hover:text-gray-300 transition-colors">Ver mis compras →</Link>
      </div>
    </div>
  );
}

export default function MiCuentaPage() {
  return (
    <ClientAreaShell>
      <main className="min-h-screen bg-[#0a0a0a] pt-10 pb-20">
        <AuthGate title="Mi cuenta" subtitle="Iniciá sesión para ver tu panel.">
          <MiCuentaContent />
        </AuthGate>
      </main>
    </ClientAreaShell>
  );
}
