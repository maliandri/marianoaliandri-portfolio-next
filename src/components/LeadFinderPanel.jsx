'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

const TIPOS = [
  { id: 'restaurant', label: 'Restaurante' },
  { id: 'cafe', label: 'Café' },
  { id: 'bar', label: 'Bar' },
  { id: 'store', label: 'Tienda' },
  { id: 'clothing_store', label: 'Ropa' },
  { id: 'hair_care', label: 'Peluquería' },
  { id: 'beauty_salon', label: 'Salón de Belleza' },
  { id: 'gym', label: 'Gimnasio' },
  { id: 'dentist', label: 'Dentista' },
  { id: 'doctor', label: 'Médico' },
  { id: 'real_estate_agency', label: 'Inmobiliaria' },
  { id: 'lawyer', label: 'Abogado' },
  { id: 'accounting', label: 'Contabilidad' },
  { id: 'school', label: 'Escuela' },
  { id: 'lodging', label: 'Alojamiento' },
  { id: 'car_repair', label: 'Mecánico' },
  { id: 'electrician', label: 'Electricista' },
  { id: 'plumber', label: 'Plomero' },
  { id: 'supermarket', label: 'Supermercado' },
  { id: 'pharmacy', label: 'Farmacia' },
  { id: 'bakery', label: 'Panadería' },
  { id: 'florist', label: 'Floristería' },
  { id: 'pet_store', label: 'Mascotas' },
  { id: 'shoe_store', label: 'Zapatería' },
  { id: 'jewelry_store', label: 'Joyería' },
  { id: 'hardware_store', label: 'Ferretería' },
  { id: 'car_dealer', label: 'Concesionaria' },
  { id: 'laundry', label: 'Lavandería' },
  { id: 'photographer', label: 'Fotógrafo' },
  { id: 'travel_agency', label: 'Ag. de Viajes' },
  { id: 'insurance_agency', label: 'Seguros' },
  { id: 'veterinary_care', label: 'Veterinaria' },
];

const DEFAULT_TIPOS = TIPOS.slice(0, 18).map(t => t.id);

function loadConfig() {
  try {
    const s = localStorage.getItem('admin_lf_config');
    if (s) {
      const p = JSON.parse(s);
      return {
        ciudad:         p.ciudad         || 'Neuquén',
        pais:           p.pais           || 'Argentina',
        radioKm:        p.radioKm        || 10,
        maxAudit:       p.maxAudit       || p.maxEmails || 60,
        buscarContacto: p.buscarContacto !== false,
        checkSites:     p.checkSites     !== false,
        apiKey:         p.apiKey         || '',
        tipos:          p.tipos          || DEFAULT_TIPOS,
      };
    }
  } catch { /* ignore */ }
  return {
    ciudad: 'Neuquén', pais: 'Argentina', radioKm: 10, maxAudit: 60,
    buscarContacto: true, checkSites: true, apiKey: '', tipos: DEFAULT_TIPOS,
  };
}

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

function formatDate(str) {
  if (!str) return null;
  try { return new Date(str).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return str.substring(0, 10); }
}

function shortUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').substring(0, 35);
}

function ScoreBadge({ score }) {
  if (score === null) return <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>;
  const cls = score >= 70
    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : score >= 40
    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {score}
    </span>
  );
}

export default function LeadFinderPanel() {
  const [config, setConfig]       = useState(loadConfig);
  const [showConfig, setShowConfig] = useState(true);
  const [phase, setPhase]         = useState('idle');
  const [progress, setProgress]   = useState({ tiposDone: 0, tiposTotal: 0, currentTipo: '', negocios: 0 });
  const [results, setResults]     = useState([]);
  const [logs, setLogs]           = useState([]);

  const [filterTipo, setFilterTipo]       = useState('');
  const [filterEmail, setFilterEmail]     = useState(false);
  const [filterSeoLow, setFilterSeoLow]   = useState(false);
  const [filterText, setFilterText]       = useState('');

  const cancelRef = useRef(false);
  const configRef = useRef(config);
  const logEndRef = useRef(null);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const isRunning = ['geocoding', 'searching'].includes(phase);

  // Derived
  const withEmail   = results.filter(r => r.email).length;
  const lowSeoCount = results.filter(r => r.seoScore !== null && r.seoScore < 50).length;
  const audited     = results.filter(r => r.seoScore !== null).length;
  const avgSeoScore = audited > 0
    ? Math.round(results.filter(r => r.seoScore !== null).reduce((a, r) => a + r.seoScore, 0) / audited)
    : null;

  const tiposEnResultados = [...new Set(results.map(r => r.tipo))];
  const filteredResults   = results.filter(r => {
    if (filterTipo   && r.tipo !== filterTipo)                              return false;
    if (filterEmail  && !r.email)                                           return false;
    if (filterSeoLow && (r.seoScore === null || r.seoScore >= 50))          return false;
    if (filterText   && !r.nombre.toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  const addLog = useCallback((msg, level = 'info') => {
    setLogs(prev => [
      ...prev.slice(-79),
      { msg, level, time: new Date().toLocaleTimeString('es', { hour12: false }) },
    ]);
  }, []);

  const callFn = useCallback(async (action, params = {}) => {
    const resp = await fetch('/api/lead-finder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, apiKey: configRef.current.apiKey, ...params }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Error en la función');
    return data;
  }, []);

  const runSearch = useCallback(async () => {
    const cfg = configRef.current;
    cancelRef.current = false;

    try {
      // 1. Geocode
      setPhase('geocoding');
      addLog(`Geocodificando ${cfg.ciudad}, ${cfg.pais}...`);
      const geo = await callFn('geocode', { city: cfg.ciudad, country: cfg.pais });
      const { lat, lon } = geo;
      addLog(`Coordenadas: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

      // 2. Buscar negocios CON web + auditar SEO inline
      setPhase('searching');
      const radiusM  = cfg.radioKm * 1000;
      const allResults = [];
      const seenIds  = new Set();

      for (let i = 0; i < cfg.tipos.length; i++) {
        if (cancelRef.current) break;
        const tipo = cfg.tipos[i];
        setProgress(prev => ({ ...prev, tiposDone: i, tiposTotal: cfg.tipos.length, currentTipo: tipo }));
        addLog(`[${i + 1}/${cfg.tipos.length}] ${tipo}...`);

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
            if (pageToken && page < 3) await sleep(2000);
          } while (pageToken && page < 3 && !cancelRef.current);

          let conWeb = 0;
          for (const place of places) {
            if (cancelRef.current) break;
            if (seenIds.has(place.id)) continue;
            seenIds.add(place.id);

            // Solo negocios CON sitio web propio (no redes sociales)
            if (!place.websiteUri) continue;
            if (isSocialUrl(place.websiteUri)) continue;

            // Confirmar con detalles
            let det = {};
            try {
              det = await callFn('getDetails', { placeId: place.id });
            } catch { /* usar datos del place */ }

            const siteUrl = det.websiteUri || place.websiteUri;
            if (isSocialUrl(siteUrl)) continue;

            const neg = {
              id:          place.id,
              nombre:      place.displayName?.text || 'Sin nombre',
              tipo,
              direccion:   det.formattedAddress        || '',
              telefono:    det.internationalPhoneNumber || '',
              rating:      place.rating ? Number(place.rating).toFixed(1) : '',
              siteUrl,
              email:       null,
              hasSitemap:  null,
              hasRobots:   null,
              lastModified: null,
              metaDesc:    null,
              hasOG:       null,
              seoScore:    null,
            };

            // Auditar SEO inline
            if (cfg.checkSites) {
              try {
                addLog(`  SEO: ${shortUrl(siteUrl)}...`);
                const siteRes = await callFn('checkSite', { url: siteUrl });
                neg.hasSitemap   = siteRes.hasSitemap;
                neg.hasRobots    = siteRes.hasRobots;
                neg.lastModified = siteRes.lastModified;
                neg.metaDesc     = siteRes.metaDesc;
                neg.hasOG        = siteRes.hasOG;
                neg.seoScore     = siteRes.seoScore;
                neg.email        = siteRes.email || null;
                if (neg.email) addLog(`  Email: ${neg.email}`, 'success');
                if (neg.seoScore !== null) addLog(`  Score SEO: ${neg.seoScore}`, neg.seoScore < 40 ? 'warn' : 'info');
              } catch (e) {
                addLog(`  Error auditando ${shortUrl(siteUrl)}: ${e.message}`, 'error');
              }
            }

            allResults.push(neg);
            setResults(prev => [...prev, { ...neg }]);
            setProgress(prev => ({ ...prev, negocios: allResults.length }));
            conWeb++;
            await sleep(300);
          }

          addLog(`  ${tipo}: ${conWeb} con web`);

        } catch (e) {
          addLog(`  Error en ${tipo}: ${e.message}`, 'error');
        }
      }

      setProgress(prev => ({ ...prev, tiposDone: cfg.tipos.length, currentTipo: '' }));
      setPhase('done');
      addLog(`¡Completado! ${allResults.length} negocios auditados.`, 'success');

    } catch (e) {
      setPhase('error');
      addLog(`Error fatal: ${e.message}`, 'error');
    }
  }, [addLog, callFn]);

  const startSearch = () => {
    try { localStorage.setItem('admin_lf_config', JSON.stringify(configRef.current)); } catch { /* ignore */ }
    setResults([]);
    setLogs([]);
    setFilterTipo(''); setFilterEmail(false); setFilterSeoLow(false); setFilterText('');
    setProgress({ tiposDone: 0, tiposTotal: 0, currentTipo: '', negocios: 0 });
    setShowConfig(false);
    runSearch();
  };

  const stopSearch = () => { cancelRef.current = true; addLog('Deteniendo...', 'warn'); };

  const exportCSV = () => {
    const headers = ['Nombre','Tipo','Dirección','Teléfono','Email','Sitio Web','SEO Score','Meta Desc','Open Graph','Sitemap','Robots.txt','Última Actualización','Rating','Place ID'];
    const sorted  = [...results].sort((a, b) => (a.seoScore ?? 999) - (b.seoScore ?? 999));
    const esc     = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows    = sorted.map(r => [
      r.nombre, r.tipo, r.direccion, r.telefono, r.email || '', r.siteUrl || '',
      r.seoScore ?? '',
      r.metaDesc  ? 'Sí' : r.seoScore !== null ? 'No' : '',
      r.hasOG     === true ? 'Sí' : r.hasOG === false ? 'No' : '',
      r.hasSitemap === true ? 'Sí' : r.hasSitemap === false ? 'No' : '',
      r.hasRobots  === true ? 'Sí' : r.hasRobots === false ? 'No' : '',
      r.lastModified ? formatDate(r.lastModified) : '',
      r.rating, r.id,
    ]);
    const csv  = [headers, ...rows].map(row => row.map(esc).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    const city = (configRef.current.ciudad || 'leads').toLowerCase().replace(/\s/g,'_').replace(/[éè]/g,'e').replace(/[áà]/g,'a').replace(/ú/g,'u').replace(/ñ/g,'n');
    a.download = `seo_audit_${city}_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const phaseInfo = {
    idle:      { dot: 'bg-gray-400',               text: 'Listo',                  color: 'text-gray-500 dark:text-gray-400' },
    geocoding: { dot: 'bg-blue-500 animate-pulse',  text: 'Geocodificando...',      color: 'text-blue-600 dark:text-blue-400' },
    searching: { dot: 'bg-yellow-500 animate-pulse',text: 'Auditando sitios SEO...', color: 'text-yellow-600 dark:text-yellow-400' },
    done:      { dot: 'bg-green-500',               text: 'Completado',             color: 'text-green-600 dark:text-green-400' },
    error:     { dot: 'bg-red-500',                 text: 'Error',                  color: 'text-red-600 dark:text-red-400' },
  }[phase] || { dot: 'bg-gray-400', text: '', color: '' };

  const searchPct = progress.tiposTotal > 0
    ? Math.round(progress.tiposDone / progress.tiposTotal * 100) : 0;

  return (
    <div className="space-y-6">

      {/* Config card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750"
          onClick={() => setShowConfig(v => !v)}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Lead Finder — SEO Audit</h2>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${phaseInfo.dot}`} />
              <span className={`text-xs font-medium ${phaseInfo.color}`}>{phaseInfo.text}</span>
            </div>
          </div>
          <span className="text-gray-400 text-sm">{showConfig ? '▲' : '▼'} Config</span>
        </div>

        {showConfig && (
          <div className="p-6 space-y-5">
            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Places API Key</label>
              <input
                type="password"
                value={config.apiKey}
                onChange={e => setConfig(p => ({ ...p, apiKey: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                placeholder="AIza... — o configura GOOGLE_PLACES_API_KEY en Vercel"
                disabled={isRunning}
              />
              <p className="text-xs text-gray-400 mt-1">
                Si <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">GOOGLE_PLACES_API_KEY</code> está en Vercel, este campo puede quedar vacío.
              </p>
            </div>

            {/* Ciudad, País, Radio, Max auditorías */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Ciudad',          key: 'ciudad',    type: 'text',   placeholder: 'Neuquén' },
                { label: 'País',            key: 'pais',      type: 'text',   placeholder: 'Argentina' },
                { label: 'Radio (km)',       key: 'radioKm',   type: 'number', min: 1, max: 50 },
                { label: 'Máx. auditorías', key: 'maxAudit',  type: 'number', min: 1, max: 500 },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={config[f.key]}
                    onChange={e => setConfig(p => ({ ...p, [f.key]: f.type === 'number' ? parseInt(e.target.value) || 1 : e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 text-sm"
                    placeholder={f.placeholder} min={f.min} max={f.max} disabled={isRunning}
                  />
                </div>
              ))}
            </div>

            {/* Toggles */}
            <div className="flex flex-wrap gap-6">
              {[
                { key: 'buscarContacto', label: 'Buscar email en páginas de contacto' },
                { key: 'checkSites',     label: 'Auditar SEO (sitemap / robots / meta / OG)' },
              ].map(t => (
                <label key={t.key} className="flex items-center gap-2 cursor-pointer select-none">
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" checked={config[t.key]}
                      onChange={e => setConfig(p => ({ ...p, [t.key]: e.target.checked }))} disabled={isRunning} />
                    <div className="w-10 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-purple-600 transition-colors" />
                    <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t.label}</span>
                </label>
              ))}
            </div>

            {/* Tipos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tipos de negocio <span className="text-gray-400">({config.tipos.length} seleccionados)</span>
                </label>
                <div className="flex gap-2">
                  {[['Todos', () => setConfig(p => ({ ...p, tipos: TIPOS.map(t => t.id) }))],
                    ['Ninguno', () => setConfig(p => ({ ...p, tipos: [] }))],
                    ['Default', () => setConfig(p => ({ ...p, tipos: DEFAULT_TIPOS }))],
                  ].map(([label, fn]) => (
                    <button key={label} onClick={fn} disabled={isRunning}
                      className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {TIPOS.map(tipo => {
                  const checked = config.tipos.includes(tipo.id);
                  return (
                    <label key={tipo.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-colors
                      ${checked ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300'
                                : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'}
                      ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input type="checkbox" checked={checked} disabled={isRunning}
                        onChange={e => { if (isRunning) return; setConfig(p => ({ ...p, tipos: e.target.checked ? [...p.tipos, tipo.id] : p.tipos.filter(t => t !== tipo.id) })); }}
                        className="accent-purple-600 w-3 h-3" />
                      {tipo.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
          {!isRunning ? (
            <button onClick={startSearch} disabled={config.tipos.length === 0}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm disabled:opacity-50">
              ▶ Iniciar Auditoría
            </button>
          ) : (
            <button onClick={stopSearch}
              className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold text-sm">
              ⏹ Detener
            </button>
          )}
          {results.length > 0 && (
            <button onClick={exportCSV}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm">
              ⬇ Exportar CSV ({results.length})
            </button>
          )}
          {results.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
              CSV ordenado por SEO Score ascendente (peores primero)
            </span>
          )}
        </div>
      </div>

      {/* Progress */}
      {(isRunning || (phase !== 'idle' && results.length > 0)) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-lg">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300 mb-1">
            <span>
              Tipos: {progress.tiposDone}/{progress.tiposTotal}
              {progress.currentTipo ? ` — ${progress.currentTipo}` : ''}
              {' '}· {progress.negocios} con web auditados
            </span>
            <span>{searchPct}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-yellow-500 h-2 rounded-full transition-all duration-300" style={{ width: `${searchPct}%` }} />
          </div>
        </div>
      )}

      {/* Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: results.length,    label: 'Con sitio web (Maps)',    color: 'text-blue-600 dark:text-blue-400' },
            { value: withEmail,         label: 'Con email encontrado',    color: 'text-green-600 dark:text-green-400' },
            { value: lowSeoCount,       label: 'SEO Score bajo (< 50)',   color: 'text-red-600 dark:text-red-400' },
            { value: avgSeoScore ?? '—',label: 'Score SEO promedio',      color: 'text-yellow-600 dark:text-yellow-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg text-center">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {filteredResults.length}/{results.length} resultados
            </span>
            <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500">
              <option value="">Todos los tipos</option>
              {tiposEnResultados.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={filterEmail} onChange={e => setFilterEmail(e.target.checked)} className="accent-purple-600" />
              Con email
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={filterSeoLow} onChange={e => setFilterSeoLow(e.target.checked)} className="accent-red-500" />
              SEO bajo (&lt; 50)
            </label>
            <input type="text" value={filterText} onChange={e => setFilterText(e.target.value)}
              placeholder="Buscar nombre..."
              className="px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 w-40" />
            <button onClick={exportCSV}
              className="ml-auto px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
              ⬇ CSV
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto" style={{ maxHeight: '540px', overflowY: 'auto' }}>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  {['Nombre','Tipo','Dirección','Teléfono','Email','Sitio web','SEO','Sitemap','Robots','Meta','OG','Actualizado','★',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {filteredResults.map(neg => (
                  <tr key={neg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-3 py-2.5 max-w-[150px]">
                      <div className="font-medium text-gray-900 dark:text-white truncate" title={neg.nombre}>{neg.nombre}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs">{neg.tipo}</span>
                    </td>
                    <td className="px-3 py-2.5 max-w-[180px]">
                      <div className="text-gray-600 dark:text-gray-400 truncate text-xs" title={neg.direccion}>{neg.direccion || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {neg.telefono ? (
                        <div className="flex items-center gap-1">
                          <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">{neg.telefono}</span>
                          <button onClick={() => navigator.clipboard.writeText(neg.telefono)} className="text-gray-300 hover:text-gray-500 text-xs" title="Copiar">📋</button>
                        </div>
                      ) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                    <td className="px-3 py-2.5 max-w-[180px]">
                      {neg.email ? (
                        <div className="flex items-center gap-1">
                          <span className="text-green-600 dark:text-green-400 text-xs truncate" title={neg.email}>{neg.email}</span>
                          <button onClick={() => navigator.clipboard.writeText(neg.email)} className="text-gray-300 hover:text-gray-500 text-xs flex-shrink-0" title="Copiar">📋</button>
                        </div>
                      ) : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 max-w-[160px]">
                      <a href={neg.siteUrl} target="_blank" rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 text-xs truncate block" title={neg.siteUrl}>
                        {shortUrl(neg.siteUrl)}
                      </a>
                    </td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <ScoreBadge score={neg.seoScore} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {neg.hasSitemap === null ? <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        : neg.hasSitemap ? <span className="text-green-500 text-sm" title="Tiene sitemap">✓</span>
                        : <span className="text-red-400 text-sm" title="Sin sitemap">✗</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {neg.hasRobots === null ? <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        : neg.hasRobots ? <span className="text-green-500 text-sm" title="Tiene robots.txt">✓</span>
                        : <span className="text-red-400 text-sm" title="Sin robots.txt">✗</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {neg.metaDesc === null && neg.seoScore === null
                        ? <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        : neg.metaDesc
                        ? <span className="text-green-500 text-sm" title={neg.metaDesc}>✓</span>
                        : <span className="text-red-400 text-sm" title="Sin meta description">✗</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {neg.hasOG === null && neg.seoScore === null
                        ? <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>
                        : neg.hasOG
                        ? <span className="text-green-500 text-sm" title="Open Graph presente">✓</span>
                        : <span className="text-red-400 text-sm" title="Sin Open Graph">✗</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {neg.lastModified
                        ? <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(neg.lastModified)}</span>
                        : <span className="text-gray-300 dark:text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-yellow-600 dark:text-yellow-400">
                      {neg.rating ? `★ ${neg.rating}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <a href={`https://www.google.com/maps/place/?q=place_id:${neg.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400">Maps</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log */}
      {logs.length > 0 && (
        <div className="bg-gray-950 rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Log</span>
            <button onClick={() => setLogs([])} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Limpiar</button>
          </div>
          <div className="h-44 overflow-y-auto px-4 py-2 space-y-0.5 font-mono text-xs">
            {logs.map((log, i) => (
              <div key={i} className={
                log.level === 'error'   ? 'text-red-400' :
                log.level === 'success' ? 'text-green-400' :
                log.level === 'warn'    ? 'text-yellow-400' : 'text-gray-500'
              }>
                <span className="text-gray-700 mr-2 select-none">{log.time}</span>
                {log.msg}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
