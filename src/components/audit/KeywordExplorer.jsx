'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { PROVINCIAS_AR } from '@/data/localidadesAR';
import { CATEGORIAS_RUBROS } from '@/data/rubros';
import { useAuthUser } from '@/hooks/useAuthUser';
import PlansModal from '@/components/payments/PlansModal';

function interesColor(v) {
  if (v >= 66) return 'bg-emerald-500';
  if (v >= 33) return 'bg-amber-500';
  return 'bg-rose-400';
}

export default function KeywordExplorer({ embedded = false }) {
  const [provincia, setProvincia] = useState('Neuquén');
  const [localidad, setLocalidad] = useState('Neuquén');
  const [cats, setCats] = useState([]); // vacío = todas
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showPlans, setShowPlans] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingSavedId, setLoadingSavedId] = useState(null);

  const { user, getIdToken, login } = useAuthUser();
  const remaining = data?.remaining; // undefined si aún no buscó; null = ilimitado
  const plan = data?.plan;

  const localidades = useMemo(
    () => PROVINCIAS_AR.find(p => p.provincia === provincia)?.localidades || [],
    [provincia]
  );

  function toggleCat(c) {
    setCats(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]));
  }

  const loadHistory = useCallback(async () => {
    const token = await getIdToken();
    if (!token) return;
    try {
      const resp = await fetch('/api/keyword-explorer/searches', { headers: { Authorization: `Bearer ${token}` } });
      const json = await resp.json().catch(() => ({}));
      setHistory(json.items || []);
    } catch { /* noop */ }
  }, [getIdToken]);

  useEffect(() => { if (user) loadHistory(); }, [user, loadHistory]);

  async function saveSearch(json) {
    const token = await getIdToken();
    if (!token) return;
    try {
      await fetch('/api/keyword-explorer/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provincia, localidad, cats, results: json.results }),
      });
      loadHistory();
    } catch { /* noop */ }
  }

  // Vuelve a mostrar una búsqueda ya guardada, sin gastar cuota ni pegarle a Google de nuevo.
  async function openSaved(id) {
    setLoadingSavedId(id);
    try {
      const token = await getIdToken();
      const resp = await fetch(`/api/keyword-explorer/searches?id=${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await resp.json().catch(() => ({}));
      if (json.results) {
        setData({ results: json.results, localidad: json.localidad, withData: json.results.filter(r => r.count > 0).length });
        setProvincia(json.provincia || provincia);
        setLocalidad(json.localidad || localidad);
        setCats(json.cats || []);
        setError('');
        setShowHistory(false);
      }
    } finally {
      setLoadingSavedId(null);
    }
  }

  async function deleteSaved(id) {
    const token = await getIdToken();
    await fetch(`/api/keyword-explorer/searches?id=${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setHistory(prev => prev.filter(h => h.id !== id));
  }

  async function analizar() {
    if (!localidad) { setError('Elegí una localidad'); return; }

    // Requiere sesión: si no hay usuario, disparamos el login
    const token = await getIdToken();
    if (!token) {
      setError('Iniciá sesión para buscar');
      login();
      return;
    }

    setLoading(true); setError(''); setData(null); setExpanded(null);
    try {
      // Filtra rubros por categoría si el usuario eligió alguna
      let rubroIds = null;
      if (cats.length) {
        const { RUBROS } = await import('@/data/rubros');
        rubroIds = RUBROS.filter(r => cats.includes(r.cat)).map(r => r.id);
      }
      const res = await fetch('/api/keyword-explorer/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provincia, localidad, rubroIds }),
      });
      const json = await res.json();

      if (res.status === 401) { setError('Iniciá sesión para buscar'); login(); return; }
      if (res.status === 402) {
        // Límite alcanzado o búsqueda gratis consumida → mostrar planes
        setError(json.error || 'Alcanzaste el límite de tu plan');
        setShowPlans(true);
        return;
      }
      if (!res.ok) throw new Error(json.error || 'Error del servidor');

      setData(json);
      if (json.withData === 0) {
        setError('Google no devolvió sugerencias (posible bloqueo desde el servidor). Probá de nuevo en unos minutos.');
      } else if (json.results?.length) {
        saveSearch(json);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!data?.results?.length) return;
    const rows = [['Rubro', 'Categoria', 'Interes', 'Sugerencias', 'Frases']];
    data.results.forEach(r => {
      rows.push([r.label, r.cat, r.interes, r.count, r.suggestions.join(' | ')]);
    });
    const csv = rows.map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `keywords-${data.localidad}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const results = data?.results || [];

  return (
    <div className={embedded ? 'max-w-3xl' : 'max-w-3xl mx-auto px-4 pt-24 pb-10'}>
      {/* Header (solo en la página standalone; en Analítica el hero ya existe) */}
      {!embedded && (
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            Rubros más buscados en tu zona
          </h1>
          <p className="mt-3 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Descubrí qué servicios busca la gente en Google en cualquier localidad de Argentina.
            Datos del autocompletado real de Google — gratis y sin registro.
          </p>
        </div>
      )}

      {/* Búsquedas anteriores */}
      {history.length > 0 && (
        <div className="mb-4 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 overflow-hidden">
          <button onClick={() => setShowHistory(v => !v)} className="w-full flex items-center justify-between px-4 py-3 text-left">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🕘 Búsquedas anteriores ({history.length})</span>
            <span className="text-gray-400 text-xs">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="divide-y divide-gray-100 dark:divide-neutral-800 border-t border-gray-100 dark:border-neutral-800">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">{h.localidad}{h.provincia ? `, ${h.provincia}` : ''}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {h.rubroCount} rubros · {h.createdAt ? new Date(h.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openSaved(h.id)} disabled={loadingSavedId === h.id}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
                      {loadingSavedId === h.id ? '⏳' : 'Ver'}
                    </button>
                    <button onClick={() => deleteSaved(h.id)} className="px-2 py-1.5 text-gray-400 hover:text-red-500 text-xs transition-colors">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Panel de control */}
      <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Provincia</span>
            <select
              value={provincia}
              onChange={e => { setProvincia(e.target.value); setLocalidad(''); }}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              {PROVINCIAS_AR.map(p => (
                <option key={p.provincia} value={p.provincia}>{p.provincia}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Localidad</span>
            <select
              value={localidad}
              onChange={e => setLocalidad(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
            >
              <option value="">— Elegí localidad —</option>
              {localidades.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
        </div>

        {/* Filtro de categorías */}
        <div className="mt-4">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Categorías <span className="text-gray-400">(vacío = todas)</span>
          </span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATEGORIAS_RUBROS.map(c => {
              const on = cats.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCat(c)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                    on
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-transparent border-gray-300 dark:border-neutral-700 text-gray-600 dark:text-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={analizar}
          disabled={loading || !localidad}
          className="mt-5 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 text-sm transition"
        >
          {loading ? 'Analizando zona…' : 'Analizar zona'}
        </button>
        {loading && (
          <p className="mt-2 text-center text-xs text-gray-400">
            Consultando Google por cada rubro, puede tardar unos segundos…
          </p>
        )}

        {/* Cuota restante tras una búsqueda */}
        {remaining !== undefined && (
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
            {remaining === null ? (
              <span className="text-emerald-500">Plan Full · búsquedas ilimitadas</span>
            ) : remaining > 0 ? (
              <>Te {remaining === 1 ? 'queda' : 'quedan'} <strong>{remaining}</strong> {remaining === 1 ? 'búsqueda' : 'búsquedas'}{plan === 'free' ? '' : ' este mes'}</>
            ) : (
              <button onClick={() => setShowPlans(true)} className="text-indigo-500 hover:underline font-medium">
                Sin búsquedas disponibles — Ver planes
              </button>
            )}
          </p>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400 text-center">{error}</p>
      )}

      {/* Resultados */}
      {data && results.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
              {data.withData} rubros con demanda en {data.localidad}
            </h2>
            <button
              onClick={exportCSV}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ↓ Exportar CSV
            </button>
          </div>

          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={r.id}
                className="rounded-xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <span className="text-xs font-mono text-gray-400 w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {r.label}
                      </span>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 tabular-nums">
                        {r.interes}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${interesColor(r.interes)}`}
                        style={{ width: `${r.interes}%` }}
                      />
                    </div>
                  </div>
                  {r.count > 0 && (
                    <span className="text-gray-400 text-xs">{expanded === r.id ? '▲' : '▼'}</span>
                  )}
                </button>

                {expanded === r.id && r.suggestions.length > 0 && (
                  <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-neutral-800">
                    <p className="text-[11px] uppercase tracking-wide text-gray-400 mt-2 mb-1.5">
                      Lo que busca la gente
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.suggestions.map((s, k) => (
                        <span
                          key={k}
                          className="px-2 py-1 rounded-md bg-gray-100 dark:bg-neutral-800 text-xs text-gray-700 dark:text-gray-300"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-gray-400 leading-relaxed">
            El <strong>interés</strong> (0–100) es relativo a esta consulta: combina cuántas variantes
            sugiere Google para el rubro en la zona y su relevancia. Un puntaje alto indica más demanda
            de búsqueda. Es una estimación basada en el autocompletado de Google, no un volumen exacto.
          </p>
        </div>
      )}

      <PlansModal
        open={showPlans}
        onClose={() => setShowPlans(false)}
        getIdToken={getIdToken}
        currentPlan={plan || 'free'}
      />
    </div>
  );
}
