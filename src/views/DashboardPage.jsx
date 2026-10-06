'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import DashboardPublisher from '@/components/dashboard/DashboardPublisher';

export default function DashboardPage() {
  const router = useRouter();
  const gridRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const auth = sessionStorage.getItem('adminAuth');
    if (auth !== 'true') {
      router.replace('/admin');
      return;
    }

    const username = sessionStorage.getItem('adminUsername');
    const password = sessionStorage.getItem('adminPassword');

    fetch('/api/dashboard-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 dark:text-gray-400">Cargando dashboard…</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-500">Error: {error}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <div className="flex items-center gap-3">
            <DashboardPublisher data={data} gridRef={gridRef} />
            <a href="/admin" className="text-sm text-indigo-500 hover:underline">← Admin</a>
          </div>
        </div>
        <div ref={gridRef}>
          <DashboardGrid data={data} />
        </div>
      </div>
    </div>
  );
}
