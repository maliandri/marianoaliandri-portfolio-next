'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PROVINCIAS_AR } from '@/data/localidadesAR';
import { RUBROS, CATEGORIAS_RUBROS, DEFAULT_TIPOS } from '@/data/rubros';
import { useAuthUser } from '@/hooks/useAuthUser';

const TIPOS = RUBROS;
const CATEGORIAS = CATEGORIAS_RUBROS;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function shortUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 35);
}

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>;
  const cls = score >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : score >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>{score}</span>;
}

export default function CustomerLeadFinderPanel() {
  const { getIdToken } = useAuthUser();

  const [ciudades, setCiudades]       = useState([]);
  const [ciudadInput, setCiudadInput] = useState('');
  const [tipos, setTipos]             = useState(DEFAULT_TIPOS);
  const [radioKm, setRadioKm]         = useState(10);
  const [showConfig, setShowConfig]   = useState(true);

  const [phase, setPhase]         = useState('idle'); // idle | searching | done | error
  const [results, setResults]     = useState([]);
  const [progress, setProgress]   = useState({ ciudadActual: '', tipoActual: '', encontrados: 0 });
  const [blocked, setBlocked]     = useState(false); // sin plan activo
  const [error, setError]         = useState('');
  const [auditingId, setAuditingId] = useState(null);
  const [auditingAll, setAuditingAll] = useState(false);

  const cancelRef = useRef(false);
  const isRunning = phase === 'searching';

  const audited     = results.filter(r => r.hasWebsite !== null).length;
  const withSite    = results.filter(r => r.hasWebsite === true).length;
  const withoutSite = results.filter(r => r.hasWebsite === false).length;
  const pending     = results.filter(r => r.hasWebsite === null && !r.auditError).length;

  const callFn = useCallback(async (action, params = {}) => {
    const idToken = await getIdToken();
    const resp = await fetch('/api/lead-finder-pro/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ action, ...params }),
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.status === 402 || data.code === 'NO_PLAN') { setBlocked(true); throw new Error(data.error || 'Sin plan activo'); }
    if (!resp.ok || !data.ok) throw new Error(data.error || `Error ${resp.status}`);
    return data;
  }, [getIdToken]);

  const runSearch = useCallback(async () => {
    cancelRef.current = false;
    setPhase('searching');
    setError('');
    const allResults = [];
    const seenIds = new Set();
    const radiusM = radioKm * 1000;

    try {
      for (const ciudad of ciudades) {
        if (cancelRef.current) break;
        setProgress(prev => ({ ...prev, ciudadActual: ciudad }));

        let lat, lon;
        try {
          const geo = await callFn('geocode', { city: ciudad, country: 'Argentina' });
          lat = geo.lat; lon = geo.lon;
        } catch (e) {
          if (blocked) throw e;
          setError(`No se pudo ubicar "${ciudad}": ${e.message}`);
          continue;
        }

        for (const tipo of tipos) {
          if (cancelRef.current) break;
          setProgress(prev => ({ ...prev, tipoActual: tipo }));
          try {
            let places = [];
            let pageToken = null;
            let page = 0;
            do {
              if (cancelRef.current) break;
              const res = await callFn('searchNearby', { lat, lon, type: tipo, radiusM, pageToken });
              places.push(...(res.places || []));
              pageToken = res.nextPageToken || null;
              page++;
              if (pageToken && page < 3) await sleep(1500);
            } while (pageToken && page < 3 && !cancelRef.current);

            for (const place of places) {
              if (seenIds.has(place.id)) continue;
              seenIds.add(place.id);
              const neg = {
                id: place.id,
                nombre: place.displayName?.text || 'Sin nombre',
                tipo, ciudad,
                lat: place.location?.latitude ?? null,
                lon: place.location?.longitude ?? null,
                previewRating: place.rating ? Number(place.rating).toFixed(1) : null,
                hasWebsite: null, siteUrl: null, seoScore: null,
                hasSitemap: null, hasRobots: null, metaDesc: null, hasOG: null,
                phone: null, openingHours: null, rating: null, ratingCount: null,
                auditError: false,
              };
              allResults.push(neg);
              setResults(prev => [...prev, neg]);
            }
            setProgress(prev => ({ ...prev, encontrados: allResults.length }));
          } catch (e) {
            if (blocked) throw e;
          }
        }
      }
      setPhase('done');
    } catch (e) {
      setPhase(blocked ? 'idle' : 'error');
      if (!blocked) setError(e.message);
    }
  }, [ciudades, tipos, radioKm, callFn, blocked]);

  const startSearch = () => {
    setResults([]);
    setError('');
    setProgress({ ciudadActual: '', tipoActual: '', encontrados: 0 });
    setShowConfig(false);
    runSearch();
  };

  const stopSearch = () => { cancelRef.current = true; };

  // Gasta 1 crédito — trae website + teléfono + horarios + rating + score SEO.
  const auditOne = async (negocio) => {
    setAuditingId(negocio.id);
    try {
      const det = await callFn('auditPlace', { placeId: negocio.id });
      setResults(prev => prev.map(r => r.id === negocio.id ? {
        ...r,
        hasWebsite: det.hasWebsite, siteUrl: det.siteUrl, seoScore: det.seoScore,
        hasSitemap: det.hasSitemap, hasRobots: det.hasRobots, metaDesc: det.metaDesc, hasOG: det.hasOG,
        phone: det.phone, openingHours: det.openingHours, rating: det.rating, ratingCount: det.ratingCount,
      } : r));
    } catch (e) {
      if (!blocked) setResults(prev => prev.map(r => r.id === negocio.id ? { ...r, auditError: true } : r));
    } finally {
      setAuditingId(null);
    }
  };

  const auditAll = async () => {
    setAuditingAll(true);
    const toAudit = results.filter(r => r.hasWebsite === null && !r.auditError);
    for (const neg of toAudit) {
      if (blocked) break;
      await auditOne(neg);
      await sleep(250);
    }
    setAuditingAll(false);
  };

  const exportCSV = () => {
    const headers = ['Nombre','Ciudad','Tipo','Teléfono','Sitio Web','SEO Score','Rating','Reseñas','Horarios'];
    const rows = results.map(r => [
      r.nombre, r.ciudad, r.tipo, r.phone || '', r.siteUrl || '', r.seoScore ?? '',
      r.rating ?? '', r.ratingCount ?? '', (r.openingHours || []).join(' | '),
    ]);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `leads_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (blocked) {
    return (
      <div className="bg-[#111] border border-amber-500/30 rounded-2xl p-8 text-center">
        <p className="text-3xl mb-3">🔒</p>
        <h3 className="text-white font-bold text-lg mb-2">No tenés un plan activo</h3>
        <p className="text-gray-400 text-sm mb-5">Elegí un plan para poder auditar negocios (buscar y explorar seguía siendo gratis).</p>
        <a href="/lead-finder-pro#planes" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
          Ver planes →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Config */}
      <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => setShowConfig(v => !v)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
          <span className="text-white font-semibold text-sm">Buscar negocios</span>
          <span className="text-gray-500 text-xs">{showConfig ? '▲' : '▼'}</span>
        </button>

        {showConfig && (
          <div className="p-5 space-y-4 border-t border-white/10">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Localidad</label>
              {ciudades.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ciudades.map(c => (
                    <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-500/10 text-indigo-300 rounded-full text-xs">
                      📍 {c}
                      <button onClick={() => setCiudades(prev => prev.filter(x => x !== c))} className="ml-0.5 text-indigo-400 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <select
                  value={ciudadInput.split('||')[0] || ''}
                  onChange={e => setCiudadInput(e.target.value + '||')}
                  disabled={isRunning}
                  className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white text-sm"
                >
                  <option value="">— Provincia —</option>
                  {PROVINCIAS_AR.map(p => <option key={p.provincia} value={p.provincia}>{p.provincia}</option>)}
                </select>
                <select
                  value={ciudadInput.split('||')[1] || ''}
                  onChange={e => setCiudadInput((ciudadInput.split('||')[0] || '') + '||' + e.target.value)}
                  disabled={isRunning || !ciudadInput.split('||')[0]}
                  className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white text-sm disabled:opacity-40"
                >
                  <option value="">— Localidad —</option>
                  {(PROVINCIAS_AR.find(p => p.provincia === ciudadInput.split('||')[0])?.localidades || []).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <button
                  onClick={() => {
                    const loc = ciudadInput.split('||')[1]?.trim();
                    if (loc && !ciudades.includes(loc)) setCiudades(prev => [...prev, loc]);
                    setCiudadInput('');
                  }}
                  disabled={isRunning || !ciudadInput.split('||')[1]?.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  + Agregar
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">Radio (km)</label>
              <input type="number" min={1} max={30} value={radioKm} disabled={isRunning}
                onChange={e => setRadioKm(parseInt(e.target.value) || 1)}
                className="w-28 px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white text-sm" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-gray-400">Rubros ({tipos.length} seleccionados)</label>
                <div className="flex gap-2">
                  <button onClick={() => setTipos(TIPOS.map(t => t.id))} disabled={isRunning} className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded hover:bg-white/10">Todos</button>
                  <button onClick={() => setTipos(DEFAULT_TIPOS)} disabled={isRunning} className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded hover:bg-white/10">Default</button>
                </div>
              </div>
              <div className="space-y-2.5">
                {CATEGORIAS.map(cat => (
                  <div key={cat}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-600 mb-1">{cat}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {TIPOS.filter(t => t.cat === cat).map(tipo => {
                        const checked = tipos.includes(tipo.id);
                        return (
                          <label key={tipo.id} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            checked ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300' : 'border-white/10 text-gray-400 hover:border-white/20'
                          } ${isRunning ? 'opacity-50' : ''}`}>
                            <input type="checkbox" checked={checked} disabled={isRunning}
                              onChange={e => setTipos(prev => e.target.checked ? [...prev, tipo.id] : prev.filter(t => t !== tipo.id))}
                              className="accent-indigo-500 w-3 h-3" />
                            {tipo.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 px-5 py-4 bg-white/[0.02] border-t border-white/10">
          {!isRunning ? (
            <button onClick={startSearch} disabled={!ciudades.length || !tipos.length}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-colors">
              🔍 Buscar
            </button>
          ) : (
            <button onClick={stopSearch} className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold text-sm transition-colors">
              ⏹ Detener
            </button>
          )}
          {results.length > 0 && (
            <button onClick={exportCSV} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors">
              ⬇ CSV
            </button>
          )}
          {pending > 0 && !isRunning && (
            <button onClick={auditAll} disabled={auditingAll}
              className="px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
              {auditingAll ? '⏳ Auditando...' : `✅ Auditar ${pending} sin auditar`}
            </button>
          )}
          {error && <span className="text-xs text-red-400 ml-auto">{error}</span>}
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-4 text-xs text-gray-400">
          📍 {progress.ciudadActual} · {progress.tipoActual} · {progress.encontrados} encontrados
        </div>
      )}

      {/* Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: results.length, label: 'Encontrados', color: 'text-white' },
            { value: withSite, label: 'Con sitio', color: 'text-green-400' },
            { value: withoutSite, label: 'Sin sitio (lead caliente)', color: 'text-purple-400' },
            { value: pending, label: 'Sin auditar', color: 'text-gray-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#111] border border-white/10 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table className="min-w-full text-sm">
              <thead className="bg-white/[0.02] sticky top-0">
                <tr>
                  {['Nombre','Ciudad','Tipo','Sitio','SEO','Tel.','★','',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {results.map(neg => (
                  <tr key={neg.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 max-w-[160px]"><div className="text-white truncate text-xs" title={neg.nombre}>{neg.nombre}</div></td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{neg.ciudad}</td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-300 rounded-full text-xs">{neg.tipo}</span></td>
                    <td className="px-3 py-2.5 max-w-[150px]">
                      {neg.hasWebsite === null ? <span className="text-gray-600 text-xs">—</span>
                        : neg.hasWebsite ? <a href={neg.siteUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 text-xs truncate block">{shortUrl(neg.siteUrl)}</a>
                        : <span className="text-purple-400 text-xs font-medium">Sin sitio 🔥</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center"><ScoreBadge score={neg.seoScore} /></td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{neg.phone || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-yellow-500 whitespace-nowrap">{neg.rating ? `★${neg.rating}` : neg.previewRating ? `★${neg.previewRating}` : '—'}</td>
                    <td className="px-3 py-2.5">
                      {neg.hasWebsite === null && !neg.auditError && (
                        <button onClick={() => auditOne(neg)} disabled={auditingId === neg.id || auditingAll}
                          className="px-2.5 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                          {auditingId === neg.id ? '⏳' : '✅ Auditar'}
                        </button>
                      )}
                      {neg.auditError && (
                        <button onClick={() => auditOne(neg)} className="px-2.5 py-1 bg-red-600/20 text-red-400 rounded-lg text-xs">⚠ Reintentar</button>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <a href={`https://www.google.com/maps/place/?q=place_id:${neg.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-300">Maps</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
