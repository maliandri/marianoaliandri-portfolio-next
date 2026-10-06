'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import DashboardPublisher from '@/components/dashboard/DashboardPublisher';

export default function DashboardPage() {
  const router  = useRouter();
  const gridRef = useRef(null);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [refreshedAt, setRefreshedAt] = useState(null);

  function load() {
    const username = sessionStorage.getItem('adminUsername');
    const password = sessionStorage.getItem('adminPassword');
    setLoading(true);
    setError(null);
    fetch('/api/dashboard-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setRefreshedAt(new Date()); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (sessionStorage.getItem('adminAuth') !== 'true') { router.replace('/admin'); return; }
    load();
  }, [router]);

  const now = refreshedAt
    ? refreshedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            {now && <p className="text-xs text-gray-400 mt-0.5">Actualizado a las {now}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {loading ? 'Cargando…' : '↺ Actualizar'}
            </button>
            {data && <DashboardPublisher data={data} gridRef={gridRef} />}
            <a href="/admin" className="text-xs text-indigo-500 hover:underline px-2">← Admin</a>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
            Error: {error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <div ref={gridRef} style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            <DashboardGrid data={data} />
          </div>
        )}
      </div>
    </div>
  );
}
