'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AuthGate from '@/components/auth/AuthGate';
import ClientNavShell from '@/components/leadfinderpro/ClientNavShell';
import AuditTable from '../../auditorias/[id]/AuditTable';
import AuditMapLoader from '../../auditorias/[id]/AuditMapLoader';
import SeoScoreChart from '../../auditorias/[id]/SeoScoreChart';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function DemoReport() {
  const [cases, setCases] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loadingCase, setLoadingCase] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auditorias?demo=1')
      .then(r => r.json())
      .then(list => {
        setCases(Array.isArray(list) ? list : []);
        if (list?.length) setSelectedId(list[0].id);
      })
      .catch(() => setCases([]));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoadingCase(true);
    setError('');
    fetch(`/api/auditorias?id=${selectedId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setAudit(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingCase(false));
  }, [selectedId]);

  if (cases === null) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <p className="text-gray-400 text-sm">Todavía no hay casos de demo cargados. Volvé pronto.</p>
      </div>
    );
  }

  const results = audit?.results || [];
  const scored = results.filter(r => typeof r.seoScore === 'number');
  const bands = [
    { key: 'debil', label: 'Débil (< 40)',      color: '#ef4444', n: scored.filter(r => r.seoScore < 40).length },
    { key: 'medio', label: 'Mejorable (40–69)', color: '#f59e0b', n: scored.filter(r => r.seoScore >= 40 && r.seoScore < 70).length },
    { key: 'bueno', label: 'Aceptable (70+)',   color: '#22c55e', n: scored.filter(r => r.seoScore >= 70).length },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
        <div>
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-1">Modo demo · datos reales ya publicados</p>
          <h1 className="text-2xl md:text-3xl font-black text-white">Así se ve una auditoría completa</h1>
        </div>
        {cases.length > 1 && (
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            className="bg-[#111] border border-white/10 text-gray-200 text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
      </div>

      {loadingCase || !audit ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm py-16 text-center">{error}</p>
      ) : (
        <>
          <p className="text-xs text-gray-600 mb-6">{formatDate(audit.publishedAt)}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { value: audit.stats?.total ?? '—',       label: 'Sitios analizados', color: 'text-white',      icon: '🌐' },
              { value: audit.stats?.withEmail ?? '—',   label: 'Con email público', color: 'text-green-400',  icon: '✉️' },
              { value: audit.stats?.lowSeoCount ?? '—', label: 'SEO débil (< 50)',  color: 'text-red-400',    icon: '⚠️' },
              { value: audit.stats?.avgSeoScore ?? '—', label: 'Score SEO promedio',color: 'text-indigo-400', icon: '📊' },
            ].map(s => (
              <div key={s.label} className="bg-[#111] border border-white/10 rounded-xl p-5 text-center">
                <div className="text-lg mb-1 opacity-70" aria-hidden>{s.icon}</div>
                <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {scored.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Distribución de Score SEO</p>
              <SeoScoreChart bands={bands} />
            </div>
          )}

          {results.some(r => typeof r.lat === 'number' && typeof r.lon === 'number') && (
            <div className="mb-8">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">Mapa de los negocios</p>
              <AuditMapLoader results={results} radioKm={audit.config?.radioKm} ownDomains={[]} />
            </div>
          )}

          <div className="mb-8">
            <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-3">
              Detalle por negocio <span className="text-gray-600 normal-case font-normal">— incluye email, igual que en el admin real</span>
            </p>
            <AuditTable results={results} ownDomains={[]} showEmail />
          </div>

          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6 text-center">
            <p className="text-white font-bold text-lg mb-1">¿Te sirve para tu zona?</p>
            <p className="text-gray-400 text-sm mb-5">Corré tu propia auditoría por localidad, provincia o país.</p>
            <a
              href="https://wa.me/?text=Hola%20Mariano%2C%20quiero%20saber%20m%C3%A1s%20sobre%20Lead%20Finder%20Pro"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Quiero mi plan <span aria-hidden>→</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}

export default function LeadFinderProDemoPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      <div className="max-w-6xl mx-auto px-4 mb-2">
        <Link href="/lead-finder-pro" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
          ← Lead Finder Pro
        </Link>
      </div>
      <AuthGate
        title="Probá Lead Finder Pro"
        subtitle="Registrate gratis para ver una auditoría real completa — mapa, score SEO y contacto de cada negocio."
      >
        <div className="max-w-6xl mx-auto px-4">
          <ClientNavShell />
        </div>
        <DemoReport />
      </AuthGate>
    </main>
  );
}
