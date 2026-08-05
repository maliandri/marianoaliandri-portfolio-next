'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PROVINCIAS_AR } from '@/data/localidadesAR';
import { RUBROS, CATEGORIAS_RUBROS } from '@/data/rubros';

// Tipos de negocio → se pasan como `includedTypes` a la Places API (New).
// Lista compartida en src/data/rubros.js (también la usa el Keyword Explorer /keywords).
const TIPOS = RUBROS;

// Orden de rubros para el UI (agrupa TIPOS por `cat` preservando este orden)
const CATEGORIAS = CATEGORIAS_RUBROS;

// Selección por defecto: los rubros de negocio local más comunes
const DEFAULT_TIPOS = [
  'restaurant', 'cafe', 'bar', 'bakery', 'store', 'clothing_store', 'hair_care',
  'beauty_salon', 'gym', 'dentist', 'real_estate_agency', 'lawyer', 'accounting',
  'car_repair', 'pharmacy', 'pet_store', 'veterinary_care', 'lodging',
];

function loadConfig() {
  try {
    const s = localStorage.getItem('admin_lf_config');
    if (s) {
      const p = JSON.parse(s);
      const ciudades = p.ciudades || (p.ciudad ? [p.ciudad] : ['Neuquén']);
      return {
        ciudades,
        pais:           p.pais           || 'Argentina',
        radioKm:        p.radioKm        || 10,
        maxAudit:       p.maxAudit       || p.maxEmails || 60,
        buscarContacto: p.buscarContacto !== false,
        checkSites:     p.checkSites     !== false,
        apiKey:         p.apiKey         || '',
        tipos:          p.tipos          || DEFAULT_TIPOS,
        terminos:       p.terminos       || [],
      };
    }
  } catch { /* ignore */ }
  return {
    ciudades: ['Neuquén'], pais: 'Argentina', radioKm: 10, maxAudit: 60,
    buscarContacto: true, checkSites: true, apiKey: '', tipos: DEFAULT_TIPOS,
    terminos: [],
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
  const [config, setConfig]         = useState(loadConfig);
  const [showConfig, setShowConfig]  = useState(true);
  const [ciudadInput, setCiudadInput] = useState('');
  const [terminoInput, setTerminoInput] = useState('');
  const [phase, setPhase]            = useState('idle');
  const [progress, setProgress]      = useState({ ciudadActual: '', tiposDone: 0, tiposTotal: 0, currentTipo: '', negocios: 0 });
  const [results, setResults]        = useState([]);
  const [logs, setLogs]              = useState([]);
  const [publishing, setPublishing]  = useState(false);
  const [publishedUrl, setPublishedUrl] = useState(null);
  const [pubModal, setPubModal]      = useState(false);
  const [pubTitle, setPubTitle]      = useState('');
  const [pubDesc, setPubDesc]        = useState('');

  const [filterTipo, setFilterTipo]       = useState('');
  const [filterEmail, setFilterEmail]     = useState(false);
  const [filterSeoLow, setFilterSeoLow]   = useState(false);
  const [filterText, setFilterText]       = useState('');

  const cancelRef  = useRef(false);
  const configRef  = useRef(config);
  const logBodyRef = useRef(null);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => {
    const el = logBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

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
      body: JSON.stringify({ action, ...params }),
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
      setPhase('searching');
      const radiusM    = cfg.radioKm * 1000;
      const allResults = [];
      const seenIds    = new Set();
      const ciudades   = cfg.ciudades?.length ? cfg.ciudades : ['Neuquén'];

      for (const ciudad of ciudades) {
        if (cancelRef.current) break;

        // Geocode cada ciudad
        setPhase('geocoding');
        addLog(`Geocodificando ${ciudad}, ${cfg.pais}...`);
        let lat, lon;
        try {
          const geo = await callFn('geocode', { city: ciudad, country: cfg.pais });
          lat = geo.lat; lon = geo.lon;
          addLog(`  ${ciudad}: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
        } catch (e) {
          addLog(`  Error geocodificando ${ciudad}: ${e.message}`, 'error');
          continue;
        }

        setPhase('searching');
        setProgress(prev => ({ ...prev, ciudadActual: ciudad, tiposDone: 0, tiposTotal: cfg.tipos.length, currentTipo: '' }));

        // Procesa una lista de places: dedup, filtra por web propia, audita SEO y agrega al resultado
        const processPlaces = async (places, etiqueta) => {
          let conWeb = 0;
          for (const place of places) {
            if (cancelRef.current) break;
            if (!place.displayName?.text) continue;
            if (seenIds.has(place.id)) continue;
            seenIds.add(place.id);

            // Solo negocios CON sitio web propio (no redes sociales)
            if (!place.websiteUri) continue;
            if (isSocialUrl(place.websiteUri)) continue;

            const siteUrl = place.websiteUri;

            const neg = {
              id:          place.id,
              nombre:      place.displayName.text,
              tipo:        etiqueta,
              ciudad,
              lat:         place.location?.latitude  ?? null,
              lon:         place.location?.longitude ?? null,
              direccion:   place._address || '',
              telefono:    place._phone   || '',
              rating:      '',
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
          return conWeb;
        };

        // 1) Búsqueda por categorías (searchNearby)
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

            const conWeb = await processPlaces(places, tipo);
            addLog(`  ${tipo}: ${conWeb} con web`);
          } catch (e) {
            addLog(`  Error en ${tipo}: ${e.message}`, 'error');
          }
        }

        // 2) Búsqueda por términos de texto libre (searchText)
        const terminos = cfg.terminos || [];
        for (let i = 0; i < terminos.length; i++) {
          if (cancelRef.current) break;
          const term = terminos[i];
          setProgress(prev => ({ ...prev, currentTipo: `"${term}"` }));
          addLog(`[texto ${i + 1}/${terminos.length}] "${term}"...`);

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
              if (pageToken && page < 3) await sleep(2000);
            } while (pageToken && page < 3 && !cancelRef.current);

            const conWeb = await processPlaces(places, term);
            addLog(`  "${term}": ${conWeb} con web`);
          } catch (e) {
            addLog(`  Error en "${term}": ${e.message}`, 'error');
          }
        }
        // fin de búsquedas para esta ciudad
    }
    // fin de ciudades

    setProgress(prev => ({ ...prev, tiposDone: cfg.tipos.length, currentTipo: '', ciudadActual: '' }));
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
    setPublishedUrl(null);
    setFilterTipo(''); setFilterEmail(false); setFilterSeoLow(false); setFilterText('');
    setProgress({ ciudadActual: '', tiposDone: 0, tiposTotal: 0, currentTipo: '', negocios: 0 });
    setShowConfig(false);
    runSearch();
  };

  const stopSearch = () => { cancelRef.current = true; addLog('Deteniendo...', 'warn'); };

  // Abre el modal de pre-publicación con título y descripción autogenerados (editables)
  const openPublishModal = () => {
    if (!results.length) return;
    const cfg = configRef.current;
    const ciudadesStr = (cfg.ciudades || []).join(', ') || 'Varias ciudades';
    const dateStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    const total = results.length;
    const pctLow = total ? Math.round((lowSeoCount / total) * 100) : 0;
    setPubTitle(`Auditoría SEO — ${ciudadesStr} (${dateStr})`);
    setPubDesc(
      `Auditoría SEO de ${total} negocios con sitio web propio en ${ciudadesStr}. ` +
      `El ${pctLow}% (${lowSeoCount}) tiene un posicionamiento web débil y el promedio general es ${avgSeoScore ?? '—'}/100. ` +
      `${withEmail} cuentan con un email público de contacto. ` +
      `El relevamiento evidencia oportunidades concretas de mejora en la presencia digital de los comercios de la zona.`
    );
    setPubModal(true);
  };

  const confirmPublish = async () => {
    if (!results.length || !pubTitle.trim()) return;
    setPublishing(true);
    try {
      const cfg  = configRef.current;
      const tiposLabels = (cfg.tipos || []).map(id => TIPOS.find(t => t.id === id)?.label || id);
      const stats = {
        total:       results.length,
        withEmail,
        lowSeoCount,
        avgSeoScore: avgSeoScore ?? null,
      };
      const config_ = {
        ciudades:    cfg.ciudades || [],
        pais:        cfg.pais,
        radioKm:     cfg.radioKm,
        tiposLabels,
      };

      const resp = await fetch('/api/auditorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: pubTitle.trim(), summary: pubDesc.trim(), config: config_, results, stats }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.id) throw new Error(data.error || 'Error al publicar');
      setPublishedUrl(`/auditorias/${data.id}`);
      addLog(`Reporte publicado: /auditorias/${data.id}`, 'success');
      setPubModal(false);
    } catch (e) {
      addLog(`Error publicando: ${e.message}`, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Nombre','Ciudad','Tipo','Dirección','Teléfono','Email','Sitio Web','SEO Score','Meta Desc','Open Graph','Sitemap','Robots.txt','Última Actualización','Rating','Place ID'];
    const sorted  = [...results].sort((a, b) => (a.seoScore ?? 999) - (b.seoScore ?? 999));
    const esc     = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows    = sorted.map(r => [
      r.nombre, r.ciudad || '', r.tipo, r.direccion, r.telefono, r.email || '', r.siteUrl || '',
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
    const normalize = s => s.toLowerCase().replace(/\s+/g,'_').replace(/[éè]/g,'e').replace(/[áà]/g,'a').replace(/[ú]/g,'u').replace(/[ó]/g,'o').replace(/[í]/g,'i').replace(/ñ/g,'n');
    const citySlug = (configRef.current.ciudades || []).map(normalize).join('-') || 'leads';
    a.download = `seo_audit_${citySlug}_${Date.now()}.csv`;
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
            {/* Ciudades */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Ciudades <span className="text-gray-400 font-normal">({config.ciudades.length} seleccionada{config.ciudades.length !== 1 ? 's' : ''})</span>
              </label>

              {/* Tags de ciudades seleccionadas */}
              {config.ciudades.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {config.ciudades.map(c => (
                    <span key={c} className="flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full text-xs">
                      📍 {c}
                      {!isRunning && (
                        <button onClick={() => setConfig(p => ({ ...p, ciudades: p.ciudades.filter(x => x !== c) }))}
                          className="ml-0.5 text-purple-400 hover:text-red-500 transition-colors leading-none font-bold">×</button>
                      )}
                    </span>
                  ))}
                  {!isRunning && config.ciudades.length > 0 && (
                    <button onClick={() => setConfig(p => ({ ...p, ciudades: [] }))}
                      className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 transition-colors">
                      Limpiar todo
                    </button>
                  )}
                </div>
              )}

              {/* Selector provincia → localidad */}
              <div className="flex gap-2">
                <select
                  value={ciudadInput.split('||')[0] || ''}
                  onChange={e => setCiudadInput(e.target.value + '||')}
                  disabled={isRunning}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 text-sm">
                  <option value="">— Provincia —</option>
                  {PROVINCIAS_AR.map(p => (
                    <option key={p.provincia} value={p.provincia}>{p.provincia}</option>
                  ))}
                </select>

                <select
                  value={ciudadInput.split('||')[1] || ''}
                  onChange={e => setCiudadInput((ciudadInput.split('||')[0] || '') + '||' + e.target.value)}
                  disabled={isRunning || !ciudadInput.split('||')[0]}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 text-sm disabled:opacity-40">
                  <option value="">— Localidad —</option>
                  {(PROVINCIAS_AR.find(p => p.provincia === ciudadInput.split('||')[0])?.localidades || []).map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    const loc = ciudadInput.split('||')[1]?.trim();
                    if (loc && !config.ciudades.includes(loc)) setConfig(p => ({ ...p, ciudades: [...p.ciudades, loc] }));
                    setCiudadInput('');
                  }}
                  disabled={isRunning || !ciudadInput.split('||')[1]?.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 text-sm font-medium transition-colors whitespace-nowrap">
                  + Agregar
                </button>
              </div>

              {/* Fallback: texto libre */}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={ciudadInput.includes('||') ? '' : ciudadInput}
                  onChange={e => setCiudadInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && ciudadInput.trim() && !ciudadInput.includes('||')) {
                      e.preventDefault();
                      const v = ciudadInput.trim();
                      if (!config.ciudades.includes(v)) setConfig(p => ({ ...p, ciudades: [...p.ciudades, v] }));
                      setCiudadInput('');
                    }
                  }}
                  disabled={isRunning}
                  placeholder="O escribí una ciudad manualmente (Enter)…"
                  className="flex-1 px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-purple-500 text-xs placeholder-gray-400"
                />
              </div>
            </div>

            {/* Términos de búsqueda (texto libre en Google Maps) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Términos de búsqueda <span className="text-gray-400 font-normal">(opcional — busca por texto en Maps)</span>
              </label>

              {config.terminos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {config.terminos.map(t => (
                    <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs">
                      🔎 {t}
                      {!isRunning && (
                        <button onClick={() => setConfig(p => ({ ...p, terminos: p.terminos.filter(x => x !== t) }))}
                          className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors leading-none font-bold">×</button>
                      )}
                    </span>
                  ))}
                  {!isRunning && (
                    <button onClick={() => setConfig(p => ({ ...p, terminos: [] }))}
                      className="text-xs text-gray-400 hover:text-red-400 px-2 py-1 transition-colors">Limpiar</button>
                  )}
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
                      if (!config.terminos.includes(v)) setConfig(p => ({ ...p, terminos: [...p.terminos, v] }));
                      setTerminoInput('');
                    }
                  }}
                  disabled={isRunning}
                  placeholder='Ej: "gomería", "estudio contable", "café de especialidad"…'
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 text-sm placeholder-gray-400"
                />
                <button
                  onClick={() => {
                    const v = terminoInput.trim();
                    if (v && !config.terminos.includes(v)) setConfig(p => ({ ...p, terminos: [...p.terminos, v] }));
                    setTerminoInput('');
                  }}
                  disabled={isRunning || !terminoInput.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-40 text-sm font-medium transition-colors whitespace-nowrap">
                  + Agregar
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">Cada término se busca por texto en cada ciudad, además de las categorías de abajo.</p>
            </div>

            {/* País, Radio, Max auditorías */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'País',            key: 'pais',     type: 'text',   placeholder: 'Argentina' },
                { label: 'Radio (km)',       key: 'radioKm',  type: 'number', min: 1, max: 50 },
                { label: 'Máx. auditorías', key: 'maxAudit', type: 'number', min: 1, max: 500 },
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
              <div className="space-y-3">
                {CATEGORIAS.map(cat => {
                  const tiposCat = TIPOS.filter(t => t.cat === cat);
                  const allOn = tiposCat.every(t => config.tipos.includes(t.id));
                  return (
                    <div key={cat}>
                      <button
                        type="button"
                        disabled={isRunning}
                        onClick={() => setConfig(p => {
                          const ids = tiposCat.map(t => t.id);
                          const tipos = allOn
                            ? p.tipos.filter(t => !ids.includes(t))
                            : [...new Set([...p.tipos, ...ids])];
                          return { ...p, tipos };
                        })}
                        className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5 hover:text-purple-500 disabled:hover:text-gray-400">
                        {cat} <span className="font-normal">({allOn ? 'quitar' : 'todos'})</span>
                      </button>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                        {tiposCat.map(tipo => {
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
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="flex flex-wrap items-center gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
          {!isRunning ? (
            <button onClick={startSearch} disabled={config.tipos.length === 0 && (config.terminos?.length || 0) === 0}
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
          {results.length > 0 && !isRunning && !publishedUrl && (
            <button onClick={openPublishModal} disabled={publishing}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold text-sm disabled:opacity-50">
              🌐 Publicar Reporte
            </button>
          )}
          {publishedUrl && (
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold text-sm">
              ✓ Ver Reporte →
            </a>
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
              {progress.ciudadActual && <span className="font-medium">📍 {progress.ciudadActual} · </span>}
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
                  {['Nombre','Ciudad','Tipo','Dirección','Teléfono','Email','Sitio web','SEO','Sitemap','Robots','Meta','OG','Actualizado','★',''].map(h => (
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
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">{neg.ciudad || '—'}</td>
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
                      <a href={`https://www.openstreetmap.org/${neg.id}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400">OSM</a>
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
          <div ref={logBodyRef} className="h-44 overflow-y-auto px-4 py-2 space-y-0.5 font-mono text-xs">
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
          </div>
        </div>
      )}

      {/* Modal de pre-publicación: título + descripción editables */}
      {pubModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !publishing && setPubModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Publicar auditoría</h3>
            <p className="text-xs text-gray-500 mb-4">Revisá el título y la descripción antes de publicar. Los podés editar.</p>

            <label className="block text-xs font-medium text-gray-500 mb-1">Título</label>
            <input
              value={pubTitle}
              onChange={e => setPubTitle(e.target.value)}
              disabled={publishing}
              className="w-full mb-4 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <label className="block text-xs font-medium text-gray-500 mb-1">Descripción del reporte</label>
            <textarea
              value={pubDesc}
              onChange={e => setPubDesc(e.target.value)}
              rows={6}
              disabled={publishing}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-[11px] text-gray-400 mt-1">Se muestra como “Análisis” en la página pública del reporte.</p>

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPubModal(false)} disabled={publishing}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={confirmPublish} disabled={publishing || !pubTitle.trim()}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {publishing ? '⏳ Publicando…' : '🌐 Publicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
