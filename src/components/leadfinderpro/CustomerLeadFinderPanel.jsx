'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';
import { lfpT } from '@/data/i18n/leadFinderPro';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Separa "Ciudad, País" en sus dos partes. Sin coma, se manda solo la ciudad
// (Nominatim igual la resuelve, con menos precisión) — ver geocode en
// src/app/api/lead-finder/route.js, que ya soporta country vacío.
function parseZona(raw) {
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length < 2) return { city: raw.trim(), country: '' };
  return { city: parts.slice(0, -1).join(', '), country: parts[parts.length - 1] };
}

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

export default function CustomerLeadFinderPanel({ lang = 'es' }) {
  const t = lfpT(lang).panel;
  const { getIdToken } = useAuthUser();

  const [ciudades, setCiudades]       = useState([]);
  const [zonaInput, setZonaInput]     = useState('');
  const [terminos, setTerminos]       = useState([]);
  const [terminoInput, setTerminoInput] = useState('');
  const [radioKm, setRadioKm]         = useState(10);
  const [showConfig, setShowConfig]   = useState(true);

  const [phase, setPhase]         = useState('idle'); // idle | searching | done | error
  const [results, setResults]     = useState([]);
  const [progress, setProgress]   = useState({ ciudadActual: '', tipoActual: '', encontrados: 0 });
  const [blocked, setBlocked]     = useState(false); // sin plan activo
  const [quotaExceeded, setQuotaExceeded] = useState(false); // cuota diaria de Google agotada
  const [error, setError]         = useState('');
  const [auditingId, setAuditingId] = useState(null);
  const [auditingAll, setAuditingAll] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingSavedId, setLoadingSavedId] = useState(null);

  const cancelRef = useRef(false);
  // Se pone en true apenas el server dice "no sigas" (sin plan / cuota agotada). Usamos un
  // ref en vez de leer el state `blocked`/`quotaExceeded` porque esos son closures viejas
  // dentro de un loop async ya arrancado (React no re-renderiza el loop en curso) — con
  // state stale, cada fila del lote seguía intentando y mostrando "Reintentar" en vez de
  // frenar apenas se detecta el corte real.
  const stopRef = useRef(false);
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
    if (resp.status === 402 || data.code === 'NO_PLAN') {
      stopRef.current = true;
      setBlocked(true);
      throw new Error(data.error || 'Sin plan activo');
    }
    if (data.code === 'QUOTA_EXCEEDED') {
      stopRef.current = true;
      setQuotaExceeded(true);
      throw new Error(data.error || 'Cuota diaria de Google Places agotada');
    }
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
          const { city, country } = parseZona(ciudad);
          const geo = await callFn('geocode', { city, country });
          lat = geo.lat; lon = geo.lon;
        } catch (e) {
          if (stopRef.current) throw e;
          setError(t.locateError(ciudad, e.message));
          continue;
        }

        // Búsqueda por texto libre en Maps — única forma de buscar (sin categorías fijas)
        for (const term of terminos) {
          if (cancelRef.current) break;
          setProgress(prev => ({ ...prev, tipoActual: `"${term}"` }));
          try {
            let places = [];
            let pageToken = null;
            let page = 0;
            do {
              if (cancelRef.current) break;
              const res = await callFn('searchText', { lat, lon, query: `${term}, ${ciudad}`, radiusM, pageToken });
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
                nombre: place.displayName?.text || t.noName,
                tipo: term, ciudad,
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
            if (stopRef.current) throw e;
          }
        }
      }
      setPhase('done');
      await checkMyAudits(allResults.map(r => r.id));
      if (allResults.length) await saveSearch(allResults);
    } catch (e) {
      setPhase(stopRef.current ? 'idle' : 'error');
      if (!stopRef.current) setError(e.message);
    }
  }, [ciudades, terminos, radioKm, callFn, t]);

  // Guarda esta búsqueda (config + resultados) en el historial del cliente, para
  // poder volver a verla despues sin relanzarla.
  const saveSearch = async (allResults) => {
    try {
      const idToken = await getIdToken();
      await fetch('/api/lead-finder-pro/searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ ciudades, terminos, radioKm, results: allResults }),
      });
      loadHistory();
    } catch { /* no bloquea la búsqueda si esto falla */ }
  };

  const loadHistory = async () => {
    try {
      const idToken = await getIdToken();
      const resp = await fetch('/api/lead-finder-pro/searches', {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      const data = await resp.json().catch(() => ({}));
      setHistory(data.items || []);
    } catch { /* noop */ }
  };

  useEffect(() => { loadHistory(); }, []);

  const openSaved = async (id) => {
    setLoadingSavedId(id);
    try {
      const idToken = await getIdToken();
      const resp = await fetch(`/api/lead-finder-pro/searches?id=${id}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      });
      const data = await resp.json().catch(() => ({}));
      if (data.results) {
        setResults(data.results);
        setCiudades(data.ciudades || []);
        setTerminos(data.terminos || []);
        setRadioKm(data.radioKm || 10);
        setPhase('done');
        setShowConfig(false);
        setShowHistory(false);
      }
    } finally {
      setLoadingSavedId(null);
    }
  };

  const deleteSaved = async (id) => {
    const idToken = await getIdToken();
    await fetch(`/api/lead-finder-pro/searches?id=${id}`, {
      method: 'DELETE',
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
    });
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  // Consulta en bloque cuáles de estos negocios ya los auditó este cliente antes —
  // los completa directo, sin gastar otro crédito ni tener que tocar "Auditar".
  const checkMyAudits = async (placeIds) => {
    if (!placeIds.length) return;
    try {
      const idToken = await getIdToken();
      const resp = await fetch('/api/lead-finder-pro/my-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({ placeIds }),
      });
      const data = await resp.json().catch(() => ({}));
      const audits = data.audits || {};
      if (!Object.keys(audits).length) return;
      setResults(prev => prev.map(r => audits[r.id] ? { ...r, ...audits[r.id], fromMyHistory: true } : r));
    } catch { /* no bloquea la búsqueda si esto falla */ }
  };

  const startSearch = () => {
    stopRef.current = false;
    setBlocked(false);
    setQuotaExceeded(false);
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
      if (!stopRef.current) setResults(prev => prev.map(r => r.id === negocio.id ? { ...r, auditError: true } : r));
    } finally {
      setAuditingId(null);
    }
  };

  const auditAll = async () => {
    setAuditingAll(true);
    const toAudit = results.filter(r => r.hasWebsite === null && !r.auditError);
    for (const neg of toAudit) {
      if (stopRef.current) break;
      await auditOne(neg);
      await sleep(250);
    }
    setAuditingAll(false);
  };

  const exportCSV = () => {
    const rows = results.map(r => [
      r.nombre, r.ciudad, r.tipo, r.phone || '', r.siteUrl || '', r.seoScore ?? '',
      r.rating ?? '', r.ratingCount ?? '', (r.openingHours || []).join(' | '),
    ]);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [t.csvHeaders, ...rows].map(row => row.map(esc).join(',')).join('\n');
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
        <h3 className="text-white font-bold text-lg mb-2">{t.blockedTitle}</h3>
        <p className="text-gray-400 text-sm mb-5">{t.blockedDesc}</p>
        <a href={lang === 'en' ? '/en/lead-finder-pro#planes' : '/lead-finder-pro#planes'} className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm">
          {t.blockedCta}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {quotaExceeded && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 flex items-start gap-3">
          <span className="text-xl">⏳</span>
          <div>
            <p className="text-amber-300 font-semibold text-sm">{t.quotaTitle}</p>
            <p className="text-gray-400 text-xs mt-0.5">{t.quotaDesc}</p>
          </div>
        </div>
      )}

      {/* Búsquedas anteriores */}
      {history.length > 0 && (
        <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
          <button onClick={() => setShowHistory(v => !v)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
            <span className="text-white font-semibold text-sm">{t.historyToggle(history.length)}</span>
            <span className="text-gray-500 text-xs">{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (
            <div className="divide-y divide-white/5 border-t border-white/10">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{(h.ciudades || []).join(', ') || t.noLocation}</p>
                    <p className="text-gray-500 text-xs">
                      {h.resultCount} · {h.createdAt ? new Date(h.createdAt).toLocaleDateString(t.locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openSaved(h.id)} disabled={loadingSavedId === h.id}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
                      {loadingSavedId === h.id ? '⏳' : t.historyView}
                    </button>
                    <button onClick={() => deleteSaved(h.id)} className="px-2 py-1.5 text-gray-500 hover:text-red-400 text-xs transition-colors">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Config */}
      <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden">
        <button onClick={() => setShowConfig(v => !v)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
          <span className="text-white font-semibold text-sm">{t.sectionHeader}</span>
          <span className="text-gray-500 text-xs">{showConfig ? '▲' : '▼'}</span>
        </button>

        {showConfig && (
          <div className="p-5 space-y-4 border-t border-white/10">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                {t.zonaLabel} <span className="text-gray-600 font-normal">{t.zonaHint}</span>
              </label>
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
                <input
                  type="text"
                  value={zonaInput}
                  onChange={e => setZonaInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && zonaInput.trim()) {
                      e.preventDefault();
                      const v = zonaInput.trim();
                      if (!ciudades.includes(v)) setCiudades(prev => [...prev, v]);
                      setZonaInput('');
                    }
                  }}
                  disabled={isRunning}
                  placeholder={t.zonaPlaceholder}
                  className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white text-sm placeholder-gray-600"
                />
                <button
                  onClick={() => {
                    const v = zonaInput.trim();
                    if (v && !ciudades.includes(v)) setCiudades(prev => [...prev, v]);
                    setZonaInput('');
                  }}
                  disabled={isRunning || !zonaInput.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {t.addBtn}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                {t.terminosLabel} <span className="text-gray-600 font-normal">{t.terminosHint}</span>
              </label>
              {terminos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {terminos.map(term => (
                    <span key={term} className="flex items-center gap-1 px-2.5 py-1 bg-blue-500/10 text-blue-300 rounded-full text-xs">
                      🔎 {term}
                      <button onClick={() => setTerminos(prev => prev.filter(x => x !== term))} className="ml-0.5 text-blue-400 hover:text-red-400">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={terminoInput}
                  onChange={e => setTerminoInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && terminoInput.trim()) {
                      e.preventDefault();
                      const v = terminoInput.trim();
                      if (!terminos.includes(v)) setTerminos(prev => [...prev, v]);
                      setTerminoInput('');
                    }
                  }}
                  disabled={isRunning}
                  placeholder={t.terminosPlaceholder}
                  className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white text-sm placeholder-gray-600"
                />
                <button
                  onClick={() => {
                    const v = terminoInput.trim();
                    if (v && !terminos.includes(v)) setTerminos(prev => [...prev, v]);
                    setTerminoInput('');
                  }}
                  disabled={isRunning || !terminoInput.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {t.addBtn}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">{t.radioLabel}</label>
              <input type="number" min={1} max={30} value={radioKm} disabled={isRunning}
                onChange={e => setRadioKm(parseInt(e.target.value) || 1)}
                className="w-28 px-3 py-2 bg-[#0a0a0a] border border-white/10 rounded-lg text-white text-sm" />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 px-5 py-4 bg-white/[0.02] border-t border-white/10">
          {!isRunning ? (
            <button onClick={startSearch} disabled={!ciudades.length || !terminos.length}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl font-semibold text-sm transition-colors">
              {t.searchBtn}
            </button>
          ) : (
            <button onClick={stopSearch} className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold text-sm transition-colors">
              {t.stopBtn}
            </button>
          )}
          {results.length > 0 && (
            <button onClick={exportCSV} className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors">
              {t.csvBtn}
            </button>
          )}
          {pending > 0 && !isRunning && (
            <button onClick={auditAll} disabled={auditingAll}
              className="px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors">
              {auditingAll ? t.auditingAllBtn : t.auditAllBtn(pending)}
            </button>
          )}
          {error && <span className="text-xs text-red-400 ml-auto">{error}</span>}
        </div>
      </div>

      {/* Progress */}
      {isRunning && (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-4 text-xs text-gray-400">
          📍 {progress.ciudadActual} · {progress.tipoActual} · {progress.encontrados} {t.progressFound}
        </div>
      )}

      {/* Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: results.length, label: t.statsFound, color: 'text-white' },
            { value: withSite, label: t.statsWithSite, color: 'text-green-400' },
            { value: withoutSite, label: t.statsWithoutSite, color: 'text-purple-400' },
            { value: pending, label: t.statsPending, color: 'text-gray-400' },
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
                  {t.tableHeaders.map((h, i) => (
                    <th key={i} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
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
                        : <span className="text-purple-400 text-xs font-medium">{t.noSite}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center"><ScoreBadge score={neg.seoScore} /></td>
                    <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">{neg.phone || '—'}</td>
                    <td className="px-3 py-2.5 text-xs text-yellow-500 whitespace-nowrap">{neg.rating ? `★${neg.rating}` : neg.previewRating ? `★${neg.previewRating}` : '—'}</td>
                    <td className="px-3 py-2.5">
                      {neg.hasWebsite === null && !neg.auditError && (
                        <button onClick={() => auditOne(neg)} disabled={auditingId === neg.id || auditingAll}
                          className="px-2.5 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors whitespace-nowrap">
                          {auditingId === neg.id ? t.auditingBtn : t.auditBtn}
                        </button>
                      )}
                      {neg.auditError && (
                        <button onClick={() => auditOne(neg)} className="px-2.5 py-1 bg-red-600/20 text-red-400 rounded-lg text-xs">{t.retryBtn}</button>
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
