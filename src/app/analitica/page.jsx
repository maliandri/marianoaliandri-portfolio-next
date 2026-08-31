'use client';

import { useState, useEffect } from 'react';
import TrendsTab   from '@/components/analitica/TrendsTab';
import KeywordsTab from '@/components/analitica/KeywordsTab';
import PlanBadge   from '@/components/analitica/PlanBadge';
import AuthGate    from '@/components/auth/AuthGate';

const REGIONS = [
  { id: 'neuquen',   label: 'Neuquén',   flag: '📍' },
  { id: 'argentina', label: 'Argentina', flag: '🇦🇷' },
];

const TABS = [
  { id: 'tendencias', label: 'Tendencias',       icon: '📈' },
  { id: 'keywords',   label: 'Rubros buscados',  icon: '🔍' },
];

export default function AnaliticaPage() {
  const [tab,    setTab]    = useState('tendencias');
  const [region, setRegion] = useState('neuquen');
  const [data,   setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/analitica')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-24 pb-20">
      {/* Hero header */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-2">Panel de datos</p>
        <h1 className="text-3xl md:text-4xl font-black text-white mb-3">Analítica Regional</h1>
        <p className="text-gray-500 text-sm max-w-xl">
          Datos actualizados diariamente sobre búsquedas, tendencias y presencia digital de comercios
          en Neuquén y Argentina. Fuente: Google Trends · Google Places.
        </p>

        {/* Última actualización */}
        {data?.trends?.date && (
          <p className="text-xs text-gray-700 mt-2">
            Última actualización: <span className="text-gray-500">{data.trends.date}</span>
            {data.trends.updatedAt && (
              <span className="text-gray-700 ml-2">
                · {new Date(data.trends.updatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        )}

        {/* Plan + cuota del usuario (solo si está logueado) */}
        <PlanBadge />
      </div>

      {/* Nav: tabs + selector de región */}
      <div className="max-w-6xl mx-auto px-4 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-[#111] border border-white/8 rounded-2xl p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {/* Badge de cobertura */}
        {tab === 'tendencias' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] border border-white/8 rounded-2xl">
            <span className="text-xs">📍</span>
            <span className="text-xs text-gray-400 font-medium">Neuquén / Comahue</span>
            <span className="text-gray-700 text-xs">·</span>
            <span className="text-xs text-gray-600">Argentina nacional</span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="max-w-6xl mx-auto px-4">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-red-400 text-sm text-center py-16">{error}</p>
        ) : (
          <>
            {tab === 'tendencias' && <TrendsTab trends={data?.trends} region={region} />}
            {tab === 'keywords' && (
              <AuthGate
                title="Rubros buscados"
                subtitle="Registrate gratis para rankear rubros por demanda de búsqueda en tu zona. Incluye 1 búsqueda sin cargo."
              >
                <KeywordsTab />
              </AuthGate>
            )}
          </>
        )}
      </div>
    </main>
  );
}
