'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { RUBROS, CATEGORIAS_RUBROS, DEFAULT_TIPOS } from '@/data/rubros';

const LeadMapView = dynamic(() => import('./LeadMapView'), { ssr: false });

const RADIO_OPTIONS = [5, 10, 15, 20, 30]; // en cuadras (100m c/u — estándar AR)
const MAX_NEGOCIOS = 120;

const SOCIAL_DOMAINS = [
  'facebook.com','fb.com','instagram.com','twitter.com','x.com',
  'linkedin.com','youtube.com','tiktok.com','pinterest.com','snapchat.com',
  'whatsapp.com','telegram.org','linktr.ee','beacons.ai','bio.link',
];
function isSocialUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return SOCIAL_DOMAINS.some(d => host === d || host.endsWith('.' + d));
  } catch { return false; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function BusinessSheet({ business, onClose }) {
  if (!business) return null;
  const b = business;
  const color = b.hasWebsite === false ? '#a855f7'
    : b.seoScore == null ? '#9ca3af'
    : b.seoScore < 40 ? '#ef4444'
    : b.seoScore < 70 ? '#f59e0b' : '#22c55e';

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1200] bg-[#111] border-t border-white/10 rounded-t-2xl p-5 shadow-2xl" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-white truncate">{b.nombre}</p>
          <p className="text-xs text-gray-500">
            {b.tipo}{b.rating ? ` · ★ ${b.rating}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-full bg-white/5 text-gray-400 hover:text-white flex items-center justify-center">✕</button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {b.hasWebsite === null && <span className="text-sm text-gray-400">Auditando…</span>}
        {b.hasWebsite === false && <span className="text-sm font-semibold text-purple-400">Sin sitio web — oportunidad</span>}
        {b.hasWebsite === true && (
          <span className="text-sm text-gray-300">
            SEO Score: <b style={{ color }}>{b.seoScore ?? '…'}{b.seoScore != null ? '/100' : ''}</b>
          </span>
        )}
      </div>

      {b.siteUrl && (
        <a href={b.siteUrl} target="_blank" rel="noopener noreferrer"
          className="mt-3 block text-sm text-blue-400 truncate">
          {b.siteUrl.replace(/^https?:\/\/(www\.)?/, '')} ↗
        </a>
      )}

      <div className="mt-4 flex gap-2">
        <a href={`https://www.google.com/maps/place/?q=place_id:${b.id}`} target="_blank" rel="noopener noreferrer"
          className="flex-1 text-center px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-200 rounded-xl text-sm font-medium transition-colors">
          Ver en Maps
        </a>
        {b.hasWebsite === false && (
          <a href={`https://wa.me/?text=${encodeURIComponent(`Hola! Vi ${b.nombre} y noté que no tiene sitio web. Te puedo ayudar a conseguir clientes online.`)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex-1 text-center px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium transition-colors">
            Contactar
          </a>
        )}
      </div>
    </div>
  );
}

export default function LeadMapPanel({ onClose }) {
  const [userLocation, setUserLocation] = useState(null);
  const [locError, setLocError]         = useState('');
  const [locLoading, setLocLoading]     = useState(false);

  const [radioCuadras, setRadioCuadras] = useState(10);
  const [tipos, setTipos]               = useState(DEFAULT_TIPOS);
  const [showFilters, setShowFilters]   = useState(false);

  const [businesses, setBusinesses]     = useState([]);
  const [phase, setPhase]               = useState('idle'); // idle | searching | auditing | done
  const [selected, setSelected]         = useState(null);

  const cancelRef = useRef(false);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError('Este navegador no soporta geolocalización');
      return;
    }
    setLocLoading(true);
    setLocError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocLoading(false);
      },
      err => {
        setLocError(err.code === 1 ? 'Permiso de ubicación denegado' : 'No se pudo obtener tu ubicación');
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => { locate(); }, [locate]);

  const callFn = useCallback(async (action, params = {}) => {
    const resp = await fetch('/api/lead-finder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Error en la función');
    return data;
  }, []);

  // Audita en background (getDetails + checkSite) un negocio ya listado en el mapa.
  const auditBusiness = useCallback(async (biz) => {
    try {
      const det = await callFn('getDetails', { placeId: biz.id });
      const websiteUri = det.websiteUri && !isSocialUrl(det.websiteUri) ? det.websiteUri : null;

      if (!websiteUri) {
        setBusinesses(prev => prev.map(b => b.id === biz.id ? { ...b, hasWebsite: false } : b));
        return;
      }

      setBusinesses(prev => prev.map(b => b.id === biz.id ? { ...b, hasWebsite: true, siteUrl: websiteUri } : b));

      const site = await callFn('checkSite', { url: websiteUri });
      setBusinesses(prev => prev.map(b => b.id === biz.id ? { ...b, seoScore: site.seoScore ?? null } : b));
    } catch {
      setBusinesses(prev => prev.map(b => b.id === biz.id ? { ...b, hasWebsite: false } : b));
    }
  }, [callFn]);

  // Pool de concurrencia simple para auditar varios negocios en paralelo sin saturar.
  const runAuditQueue = useCallback(async (items) => {
    let i = 0;
    const concurrency = 4;
    async function worker() {
      while (i < items.length) {
        if (cancelRef.current) return;
        const item = items[i++];
        await auditBusiness(item);
        await sleep(150);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  }, [auditBusiness]);

  const runSearch = useCallback(async () => {
    if (!userLocation) return;
    cancelRef.current = false;
    setBusinesses([]);
    setSelected(null);
    setPhase('searching');

    const radiusM = radioCuadras * 100;
    const seenIds = new Set();
    const collected = [];

    for (const tipo of tipos) {
      if (cancelRef.current) break;
      if (collected.length >= MAX_NEGOCIOS) break;
      try {
        const res = await callFn('searchNearby', { lat: userLocation.lat, lon: userLocation.lon, type: tipo, radiusM });
        const label = RUBROS.find(r => r.id === tipo)?.label || tipo;
        for (const place of (res.places || [])) {
          if (seenIds.has(place.id)) continue;
          seenIds.add(place.id);
          const biz = {
            id: place.id,
            nombre: place.displayName?.text || 'Sin nombre',
            tipo: label,
            lat: place.location?.latitude ?? null,
            lon: place.location?.longitude ?? null,
            rating: place.rating ? Number(place.rating).toFixed(1) : '',
            hasWebsite: null,
            siteUrl: null,
            seoScore: null,
          };
          collected.push(biz);
          setBusinesses(prev => [...prev, biz]);
          if (collected.length >= MAX_NEGOCIOS) break;
        }
      } catch {
        // seguimos con el siguiente tipo aunque uno falle
      }
    }

    setPhase('auditing');
    await runAuditQueue(collected);
    setPhase(cancelRef.current ? 'idle' : 'done');
  }, [userLocation, radioCuadras, tipos, callFn, runAuditQueue]);

  const stopSearch = () => { cancelRef.current = true; setPhase('idle'); };

  const isBusy = phase === 'searching' || phase === 'auditing';
  const withSite    = businesses.filter(b => b.hasWebsite === true).length;
  const withoutSite = businesses.filter(b => b.hasWebsite === false).length;
  const pending      = businesses.filter(b => b.hasWebsite === null).length;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" style={{ top: 0 }}>
      {/* Barra superior */}
      <div className="shrink-0 bg-[#0a0a0a] border-b border-white/10 px-4 py-3 space-y-3" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onClose && (
              <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-full bg-white/5 text-gray-300 hover:bg-white/10 flex items-center justify-center" aria-label="Volver al admin">
                ‹
              </button>
            )}
            <p className="text-sm font-bold text-white truncate">📍 Mapa de Leads</p>
          </div>
          <button
            onClick={locate}
            disabled={locLoading}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-50"
          >
            {locLoading ? 'Ubicando…' : userLocation ? '🔄 Mi ubicación' : '📍 Ubicarme'}
          </button>
        </div>

        {locError && <p className="text-xs text-red-400">{locError}</p>}

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={radioCuadras}
            onChange={e => setRadioCuadras(Number(e.target.value))}
            disabled={isBusy}
            className="px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
          >
            {RADIO_OPTIONS.map(c => <option key={c} value={c}>{c} cuadras</option>)}
          </select>

          <button
            onClick={() => setShowFilters(v => !v)}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300"
          >
            🎛️ Rubros ({tipos.length})
          </button>

          {!isBusy ? (
            <button
              onClick={runSearch}
              disabled={!userLocation || tipos.length === 0}
              className="ml-auto px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              Buscar acá
            </button>
          ) : (
            <button onClick={stopSearch} className="ml-auto px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
              ⏹ Detener
            </button>
          )}
        </div>

        {businesses.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{businesses.length} negocios</span>
            <span className="text-purple-400">{withoutSite} sin sitio</span>
            <span className="text-gray-300">{withSite} con sitio</span>
            {pending > 0 && <span className="text-gray-500">{pending} auditando…</span>}
          </div>
        )}

        {/* Drawer de filtros de rubros */}
        {showFilters && (
          <div className="max-h-56 overflow-y-auto bg-white/5 rounded-xl p-3 space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setTipos(RUBROS.map(r => r.id))} disabled={isBusy}
                className="text-[11px] px-2 py-1 bg-white/10 rounded text-gray-300">Todos</button>
              <button onClick={() => setTipos(DEFAULT_TIPOS)} disabled={isBusy}
                className="text-[11px] px-2 py-1 bg-white/10 rounded text-gray-300">Comunes</button>
              <button onClick={() => setTipos([])} disabled={isBusy}
                className="text-[11px] px-2 py-1 bg-white/10 rounded text-gray-300">Ninguno</button>
            </div>
            {CATEGORIAS_RUBROS.map(cat => (
              <div key={cat}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-1">{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {RUBROS.filter(r => r.cat === cat).map(r => {
                    const checked = tipos.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        disabled={isBusy}
                        onClick={() => setTipos(prev => checked ? prev.filter(t => t !== r.id) : [...prev, r.id])}
                        className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                          checked ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-white/10 text-gray-500'
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="flex-1 relative">
        {userLocation ? (
          <LeadMapView userLocation={userLocation} businesses={businesses} onSelect={setSelected} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500 px-6 text-center">
            {locLoading ? 'Obteniendo tu ubicación…' : 'Activá la ubicación para ver el mapa'}
          </div>
        )}
      </div>

      <BusinessSheet business={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
