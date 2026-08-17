'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

function formatARS(amount) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status, plan }) {
  if (plan === 'free') {
    return <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full border bg-gray-500/10 text-gray-500 border-gray-500/30">Free</span>;
  }
  const cls = status === 'active'
    ? 'bg-green-500/15 text-green-400 border-green-500/30'
    : status === 'pending'
    ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';
  const label = status === 'active' ? 'Activa' : status === 'pending' ? 'Pendiente' : 'Cancelada';
  return <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>;
}

const PLAN_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'paid', label: 'Pagos' },
  { id: 'basico', label: 'Básico' },
  { id: 'full', label: 'Full' },
  { id: 'free', label: 'Free' },
];

export default function SubscriptionsManager() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('paid');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin-subscriptions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar');
      setSubscriptions(data.subscriptions || []);
      setStats(data.stats || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let list = subscriptions;
    if (filter === 'paid') list = list.filter(s => s.plan !== 'free');
    else if (filter !== 'all') list = list.filter(s => s.plan === filter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(s =>
        (s.email || '').toLowerCase().includes(q) ||
        (s.displayName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [subscriptions, filter, search]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
        ❌ {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Suscripciones pagas activas</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.activePaid}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">MRR estimado</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{formatARS(stats.mrr)}</p>
          </div>
          <div className="bg-white dark:bg-neutral-900 rounded-2xl p-5 border border-gray-200 dark:border-neutral-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total usuarios con cuota</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {PLAN_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                filter === f.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-neutral-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por email o nombre..."
          className="ml-auto px-3 py-2 rounded-xl border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
        />
        <button
          onClick={load}
          className="px-3 py-2 rounded-xl border border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 text-sm font-medium transition-colors"
        >
          🔄 Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-800">
            <thead>
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usuario</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Plan</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Uso del mes</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Próx. renovación</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
              {filtered.map(s => (
                <tr key={s.uid} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50">
                  <td className="px-5 py-3 text-sm">
                    <div className="text-gray-900 dark:text-white font-medium">{s.displayName || '(sin nombre)'}</div>
                    <div className="text-gray-500 dark:text-gray-400 text-xs">{s.email || s.uid}</div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-900 dark:text-white">
                    {s.planName}
                    {s.planPrice > 0 && <span className="text-gray-500 dark:text-gray-400 text-xs ml-1">({formatARS(s.planPrice)}/mes)</span>}
                  </td>
                  <td className="px-5 py-3 text-sm"><StatusBadge status={s.planStatus} plan={s.plan} /></td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {s.usageLimit === null ? `${s.usageCount} (ilimitado)` : `${s.usageCount}/${s.usageLimit}`}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDate(s.planRenewsAt)}</td>
                  <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(s.updatedAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                    No hay suscripciones para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
