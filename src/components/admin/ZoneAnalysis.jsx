'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, addDoc, getDocs, orderBy, query, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../utils/firebaseservice';

const TIPOS = [
  { id: 'restaurant', label: 'Restaurantes', emoji: '🍽️' },
  { id: 'combustible', label: 'Combustible', emoji: '⛽' },
  { id: 'supermercado', label: 'Supermercados', emoji: '🛒' },
  { id: 'comercio', label: 'Comercios', emoji: '🏪' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'todos', label: 'Todos', emoji: '📍' },
];

const QUICK_PRESETS = [
  {
    label: 'Hoy: mañana vs tarde',
    apply: () => {
      const today = new Date().toISOString().split('T')[0];
      return {
        p1: { label: 'Mañana pico', dateFrom: today, timeFrom: '07:00', dateTo: today, timeTo: '10:00' },
        p2: { label: 'Tarde-noche', dateFrom: today, timeFrom: '17:00', dateTo: today, timeTo: '20:00' },
      };
    },
  },
  {
    label: 'Esta semana vs semana pasada',
    apply: () => {
      const now = new Date();
      const day = now.getDay() || 7;
      const mon = new Date(now.getTime() - (day - 1) * 86400000);
      const fmt = d => d.toISOString().split('T')[0];
      const thisMon = fmt(mon);
      const thisFri = fmt(new Date(mon.getTime() + 4 * 86400000));
      const lastMon = fmt(new Date(mon.getTime() - 7 * 86400000));
      const lastFri = fmt(new Date(mon.getTime() - 3 * 86400000));
      return {
        p1: { label: 'Semana pasada', dateFrom: lastMon, timeFrom: '08:00', dateTo: lastFri, timeTo: '18:00' },
        p2: { label: 'Esta semana', dateFrom: thisMon, timeFrom: '08:00', dateTo: thisFri, timeTo: '18:00' },
      };
    },
  },
  {
    label: 'Este mes vs mes pasado',
    apply: () => {
      const now = new Date();
      const fmt = d => d.toISOString().split('T')[0];
      const thisStart = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
      const thisEnd = fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      const lastStart = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const lastEnd = fmt(new Date(now.getFullYear(), now.getMonth(), 0));
      return {
        p1: { label: 'Mes pasado', dateFrom: lastStart, timeFrom: '08:00', dateTo: lastEnd, timeTo: '20:00' },
        p2: { label: 'Este mes', dateFrom: thisStart, timeFrom: '08:00', dateTo: thisEnd, timeTo: '20:00' },
      };
    },
  },
];

const RADIOS = [
  { value: 500, label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
  { value: 5000, label: '5km' },
];

const CONGESTION_ICONS = { LOW: '🟢', MEDIUM: '🟡', HIGH: '🔴' };
const CONGESTION_LABELS = { LOW: 'Fluido', MEDIUM: 'Moderado', HIGH: 'Congestionado' };

function PeriodoPicker({ label, value, onChange }) {
  return (
    <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600 space-y-3">
      <p className="text-purple-400 font-semibold text-sm">{label}</p>
      <div>
        <label className="text-gray-400 text-xs mb-1 block">Etiqueta</label>
        <input
          type="text"
          value={value.label}
          onChange={e => onChange({ ...value, label: e.target.value })}
          placeholder="Ej: Enero mañana"
          className="w-full bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Desde — fecha</label>
          <input
            type="date"
            value={value.dateFrom}
            onChange={e => onChange({ ...value, dateFrom: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-2 py-2 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Desde — hora</label>
          <input
            type="time"
            value={value.timeFrom}
            onChange={e => onChange({ ...value, timeFrom: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-2 py-2 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Hasta — fecha</label>
          <input
            type="date"
            value={value.dateTo}
            onChange={e => onChange({ ...value, dateTo: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-2 py-2 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">Hasta — hora</label>
          <input
            type="time"
            value={value.timeTo}
            onChange={e => onChange({ ...value, timeTo: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-2 py-2 rounded-lg focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>
    </div>
  );
}

// Tamaño por defecto del rectángulo: ~1km × 1km
const DEFAULT_OFFSET_LAT = 0.004;
const DEFAULT_OFFSET_LNG = 0.006;

export default function ZoneAnalysis() {
  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const rectangleRef = useRef(null);
  const [addressInput, setAddressInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeError, setGeocodeError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Zona config
  const [titulo, setTitulo] = useState('');
  const [bounds, setBounds] = useState(null); // { north, south, east, west }
  const [tipos, setTipos] = useState(['todos']);
  // Períodos
  const [periodo1, setPeriodo1] = useState({ label: 'Mañana pico', dateFrom: today, timeFrom: '07:00', dateTo: today, timeTo: '10:00' });
  const [periodo2, setPeriodo2] = useState({ label: 'Tarde-noche', dateFrom: today, timeFrom: '17:00', dateTo: today, timeTo: '20:00' });

  // UI states
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [historial, setHistorial] = useState([]);

  // Publicar
  const [showPublish, setShowPublish] = useState(false);
  const [pubNetwork, setPubNetwork] = useState('LinkedIn');
  const [pubTone, setPubTone] = useState('informativo');
  const [extraContext, setExtraContext] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState('');

  // Zonas guardadas
  const [zonasGuardadas, setZonasGuardadas] = useState([]);

  // Load Google Maps
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';
    const loader = new Loader({ apiKey, version: 'weekly', libraries: ['places', 'drawing'] });
    loader.load().then(initMap).catch(e => console.error('Maps load error:', e));
  }, []);

  const placeRectangle = useCallback((centerLat, centerLng) => {
    if (!googleMapRef.current || !window.google) return;
    const newBounds = {
      north: centerLat + DEFAULT_OFFSET_LAT,
      south: centerLat - DEFAULT_OFFSET_LAT,
      east:  centerLng + DEFAULT_OFFSET_LNG,
      west:  centerLng - DEFAULT_OFFSET_LNG,
    };
    if (rectangleRef.current) rectangleRef.current.setMap(null);
    const rect = new window.google.maps.Rectangle({
      map: googleMapRef.current,
      bounds: newBounds,
      strokeColor: '#7c3aed',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#7c3aed',
      fillOpacity: 0.15,
      editable: true,
      draggable: true,
    });
    rectangleRef.current = rect;
    setBounds(newBounds);
    window.google.maps.event.addListener(rect, 'bounds_changed', () => {
      const b = rect.getBounds();
      if (!b) return;
      setBounds({
        north: b.getNorthEast().lat(),
        east:  b.getNorthEast().lng(),
        south: b.getSouthWest().lat(),
        west:  b.getSouthWest().lng(),
      });
    });
    googleMapRef.current.fitBounds(newBounds, 60);
  }, []);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const centerLat = -38.9516, centerLng = -68.0591;
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: centerLat, lng: centerLng },
      zoom: 14,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'simplified' }] }],
    });
    googleMapRef.current = map;
    placeRectangle(centerLat, centerLng);
  }, [placeRectangle]);

  const handleGeocode = async () => {
    if (!addressInput.trim()) return;
    setIsGeocoding(true);
    setGeocodeError('');
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(addressInput)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se encontró la dirección');
      setAddressInput(data.formatted_address);
      placeRectangle(data.lat, data.lng);
    } catch (e) {
      setGeocodeError(e.message);
    } finally {
      setIsGeocoding(false);
    }
  };

  // Load historial
  useEffect(() => {
    const loadHistorial = async () => {
      try {
        const q = query(collection(db, 'analisis_zonas'), orderBy('createdAt', 'desc'), limit(5));
        const snap = await getDocs(q);
        setHistorial(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        const zq = query(collection(db, 'zonas_analisis'), orderBy('createdAt', 'desc'), limit(10));
        const zsnap = await getDocs(zq);
        setZonasGuardadas(zsnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
    };
    loadHistorial();
  }, []);

  const applyQuickPreset = (preset) => {
    const { p1, p2 } = preset.apply();
    setPeriodo1(p1);
    setPeriodo2(p2);
  };

  const toggleTipo = (id) => {
    if (id === 'todos') { setTipos(['todos']); return; }
    setTipos(prev => {
      const without = prev.filter(t => t !== 'todos');
      return without.includes(id) ? without.filter(t => t !== id) || ['todos'] : [...without, id];
    });
  };

  const handleAnalizar = async () => {
    if (!titulo.trim()) { setError('Ingresá un título para la zona'); return; }
    if (!bounds) { setError('Definí la zona en el mapa'); return; }
    setError('');
    setIsAnalyzing(true);
    setResult(null);

    try {
      const res = await fetch('/api/zone-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zona: { titulo, bounds, tipos },
          periodo1: { label: periodo1.label, dateFrom: periodo1.dateFrom, timeFrom: periodo1.timeFrom, dateTo: periodo1.dateTo, timeTo: periodo1.timeTo },
          periodo2: { label: periodo2.label, dateFrom: periodo2.dateFrom, timeFrom: periodo2.timeFrom, dateTo: periodo2.dateTo, timeTo: periodo2.timeTo },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en el análisis');

      setResult(data);
      setStep(4);

      // Guardar en Firestore
      await addDoc(collection(db, 'analisis_zonas'), {
        zona_titulo: titulo, bounds,
        periodo1, periodo2,
        traffic: data.traffic,
        commercial: data.commercial,
        map_image_url: data.map_image_url,
        createdAt: serverTimestamp(),
      });

      setHistorial(prev => [{ zona_titulo: titulo, traffic: data.traffic, commercial: data.commercial, map_image_url: data.map_image_url, ...data }, ...prev].slice(0, 5));
    } catch (e) {
      setError(e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePublicar = async () => {
    if (!result) return;
    setIsPublishing(true);
    setPublishStatus('');
    try {
      const res = await fetch('/api/publish-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: result.summary,
          content: result.summary,
          caption: result.summary,
          description: result.summary,
          message: result.summary,
          networks: pubNetwork === 'Todas' ? ['linkedin', 'facebook'] : [pubNetwork.toLowerCase()],
          type: 'zone_analysis',
          useAI: true,
          aiProvider: 'gemini',
          imageUrl: result.map_image_url,
          url:      result.map_image_url,
          extra_context: extraContext.trim() || undefined,
          metadata: {
            tone: pubTone,
            zona_titulo: result.zona_titulo,
            summary: result.summary,
            traffic: result.traffic,
            commercial: result.commercial,
          },
        }),
      });
      if (!res.ok) throw new Error('Error al publicar');
      setPublishStatus('success');
    } catch (e) {
      setPublishStatus('error');
    } finally {
      setIsPublishing(false);
    }
  };

  const loadHistorialItem = (item) => {
    setTitulo(item.zona_titulo || '');
    if (item.bounds) setBounds(item.bounds);
    setResult(item);
    setStep(4);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">🗺️ Análisis de Zona Urbana</h2>
          <p className="text-gray-400 text-sm mt-1">Tráfico vial + actividad comercial por zona y período</p>
        </div>
        {step > 1 && (
          <button onClick={() => { setStep(1); setResult(null); }} className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Nueva zona
          </button>
        )}
      </div>

      {/* Steps indicator */}
      <div className="flex gap-2">
        {[{ n: 1, label: 'Zona' }, { n: 2, label: 'Fechas' }, { n: 3, label: 'Analizar' }, { n: 4, label: 'Resultados' }].map(s => (
          <div key={s.n} className={`flex items-center gap-1 text-xs ${step >= s.n ? 'text-purple-400' : 'text-gray-600'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.n ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-500'}`}>{s.n}</span>
            <span className="hidden sm:block">{s.label}</span>
            {s.n < 4 && <span className="text-gray-600 mx-1">→</span>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN — Config */}
        <div className="space-y-4">

          {/* PASO 1 — Zona */}
          <AnimatePresence>
            {step <= 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">1</span>
                  Configurar Zona
                </h3>

                {/* Zona guardada */}
                {zonasGuardadas.length > 0 && (
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Cargar zona guardada</label>
                    <select
                      onChange={e => {
                        const z = zonasGuardadas.find(z => z.id === e.target.value);
                        if (z) { setTitulo(z.titulo); setLat(z.lat); setLng(z.lng); setRadio(z.radio); setTipos(z.tipos); }
                      }}
                      className="w-full bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500"
                    >
                      <option value="">— Elegir zona guardada —</option>
                      {zonasGuardadas.map(z => <option key={z.id} value={z.id}>{z.titulo}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Título de la zona</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    placeholder="Ej: Multitrocha Neuquén"
                    className="w-full bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Ubicación central</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addressInput}
                      onChange={e => setAddressInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleGeocode()}
                      placeholder="Ej: Av. Argentina 1234, Neuquén"
                      className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 placeholder-gray-500"
                    />
                    <button
                      onClick={handleGeocode}
                      disabled={isGeocoding || !addressInput.trim()}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm transition-all"
                    >
                      {isGeocoding ? '⏳' : '🔍'}
                    </button>
                  </div>
                  {geocodeError && <p className="text-red-400 text-xs mt-1">{geocodeError}</p>}
                  {lat !== -38.9516 && <p className="text-green-400 text-xs mt-1">📍 {lat.toFixed(5)}, {lng.toFixed(5)}</p>}
                </div>

                {bounds && (
                  <div className="bg-purple-900/30 border border-purple-700 rounded-lg px-3 py-2 text-xs text-purple-300">
                    📐 Zona seleccionada · Arrastrá las esquinas para ajustar
                    <div className="text-gray-400 mt-0.5 font-mono">
                      N {bounds.north.toFixed(5)} · S {bounds.south.toFixed(5)} · E {bounds.east.toFixed(5)} · O {bounds.west.toFixed(5)}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-gray-400 text-xs mb-2 block">Tipos de locales</label>
                  <div className="flex flex-wrap gap-2">
                    {TIPOS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => toggleTipo(t.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${tipos.includes(t.id) ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      >
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mini mapa */}
                <div ref={mapRef} className="w-full h-48 rounded-xl overflow-hidden border border-gray-600 bg-gray-700" />

                <button
                  onClick={() => setStep(2)}
                  disabled={!titulo.trim()}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm"
                >
                  Siguiente: Fechas →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* PASO 2 — Fechas */}
          <AnimatePresence>
            {step >= 2 && step <= 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">2</span>
                  Comparar Períodos
                </h3>

                {/* Presets rápidos */}
                <div>
                  <label className="text-gray-400 text-xs mb-2 block">Presets rápidos</label>
                  <div className="flex flex-col gap-1">
                    {QUICK_PRESETS.map(p => (
                      <button
                        key={p.label}
                        onClick={() => applyQuickPreset(p)}
                        className="text-left px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-all"
                      >
                        ⚡ {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <PeriodoPicker label="Período 1" value={periodo1} onChange={setPeriodo1} />
                  <PeriodoPicker label="Período 2" value={periodo2} onChange={setPeriodo2} />
                </div>

                <button
                  onClick={() => setStep(3)}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all text-sm"
                >
                  Siguiente: Analizar →
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* PASO 3 — Analizar */}
          <AnimatePresence>
            {step === 3 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800 rounded-xl p-5 border border-gray-700 space-y-4">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">3</span>
                  Resumen del análisis
                </h3>
                <div className="bg-gray-700/50 rounded-lg p-3 text-sm text-gray-300 space-y-1">
                  <p><span className="text-gray-500">Zona:</span> {titulo}</p>
                  {bounds && <p><span className="text-gray-500">Rectángulo:</span> N{bounds.north.toFixed(4)} S{bounds.south.toFixed(4)} E{bounds.east.toFixed(4)} O{bounds.west.toFixed(4)}</p>}
                  <p><span className="text-gray-500">Período 1:</span> {periodo1.label} — {periodo1.dateFrom} {periodo1.timeFrom} → {periodo1.dateTo} {periodo1.timeTo}</p>
                  <p><span className="text-gray-500">Período 2:</span> {periodo2.label} — {periodo2.dateFrom} {periodo2.timeFrom} → {periodo2.dateTo} {periodo2.timeTo}</p>
                  <p><span className="text-gray-500">Tipos:</span> {tipos.join(', ')}</p>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button
                  onClick={handleAnalizar}
                  disabled={isAnalyzing}
                  className="w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                >
                  {isAnalyzing ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Analizando...
                    </span>
                  ) : '🔍 Generar Análisis'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Historial */}
          {historial.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
              <h3 className="text-white font-semibold text-sm mb-3">📋 Últimos análisis</h3>
              <div className="space-y-2">
                {historial.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => loadHistorialItem(item)}
                    className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all"
                  >
                    <p className="text-white text-xs font-medium">{item.zona_titulo}</p>
                    <p className="text-gray-500 text-xs">{item.commercial?.total_places} locales · {item.traffic?.periodo1?.label} vs {item.traffic?.periodo2?.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — Resultados */}
        <div className="space-y-4">
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                {/* Mapa estático */}
                <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <h3 className="text-white font-semibold text-sm">{result.zona_titulo}</h3>
                    <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded-full">{RADIOS.find(r => r.value === radio)?.label}</span>
                  </div>
                  <img src={result.map_image_url} alt="Mapa de zona" className="w-full h-52 object-cover" />
                </div>

                {/* Tráfico */}
                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">🚗 Tráfico Vial</h3>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[result.traffic.periodo1, result.traffic.periodo2].map((p, i) => (
                      <div key={i} className="bg-gray-700/50 rounded-xl p-3 text-center">
                        <p className="text-gray-400 text-xs mb-1">{p.label}</p>
                        <p className="text-white text-2xl font-bold">{p.minutes}<span className="text-sm font-normal text-gray-400"> min</span></p>
                        <p className="text-sm mt-1">{CONGESTION_ICONS[p.congestion]} <span className="text-gray-400 text-xs">{CONGESTION_LABELS[p.congestion]}</span></p>
                      </div>
                    ))}
                  </div>
                  <div className={`rounded-xl p-3 text-center text-sm font-medium ${result.traffic.delta_direction === 'worse' ? 'bg-red-900/30 text-red-400' : result.traffic.delta_direction === 'better' ? 'bg-green-900/30 text-green-400' : 'bg-gray-700/50 text-gray-400'}`}>
                    {result.traffic.delta_direction === 'worse' && `🔴 ${result.traffic.delta_minutes} min más lento en ${result.traffic.periodo2.label} (+${result.traffic.delta_percent}%)`}
                    {result.traffic.delta_direction === 'better' && `🟢 ${Math.abs(result.traffic.delta_minutes)} min más rápido en ${result.traffic.periodo2.label} (-${result.traffic.delta_percent}%)`}
                    {result.traffic.delta_direction === 'equal' && '⚪ Sin diferencia significativa entre períodos'}
                  </div>
                </div>

                {/* Zona Comercial */}
                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">🏪 Zona Comercial</h3>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-gray-700/50 rounded-xl p-3 text-center">
                      <p className="text-white text-2xl font-bold">{result.commercial.total_places}</p>
                      <p className="text-gray-400 text-xs">Locales</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-xl p-3 text-center">
                      <p className="text-green-400 text-2xl font-bold">{result.commercial.open_now}</p>
                      <p className="text-gray-400 text-xs">Abiertos</p>
                    </div>
                    <div className="bg-gray-700/50 rounded-xl p-3 text-center">
                      <p className="text-yellow-400 text-2xl font-bold">⭐{result.commercial.avg_rating}</p>
                      <p className="text-gray-400 text-xs">Promedio</p>
                    </div>
                  </div>

                  {result.commercial.top_places?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-gray-400 text-xs font-medium">Top lugares</p>
                      {result.commercial.top_places.map((p, i) => (
                        <div key={i} className="flex items-center justify-between py-1 border-b border-gray-700/50 last:border-0">
                          <div>
                            <p className="text-white text-xs font-medium">{p.name}</p>
                            <p className="text-gray-500 text-xs">{p.type.replace('_', ' ')}</p>
                          </div>
                          <span className="text-yellow-400 text-xs">⭐ {p.rating}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Publicar */}
                <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                  <button onClick={() => setShowPublish(!showPublish)} className="w-full flex items-center justify-between text-white font-semibold text-sm">
                    <span>📢 Publicar análisis en redes</span>
                    <span className="text-gray-400">{showPublish ? '▲' : '▼'}</span>
                  </button>

                  <AnimatePresence>
                    {showPublish && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-3 overflow-hidden">
                        <div>
                          <label className="text-gray-400 text-xs mb-2 block">Red social</label>
                          <div className="flex gap-2">
                            {['LinkedIn', 'Facebook', 'Instagram', 'Todas'].map(n => (
                              <button key={n} onClick={() => setPubNetwork(n)}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${pubNetwork === n ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-2 block">Tono</label>
                          <div className="flex gap-2">
                            {['informativo', 'técnico', 'periodístico'].map(t => (
                              <button key={t} onClick={() => setPubTone(t)}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${pubTone === t ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Contexto adicional para Gemini <span className="text-gray-600">(opcional)</span></label>
                          <textarea
                            value={extraContext}
                            onChange={e => setExtraContext(e.target.value)}
                            rows={3}
                            placeholder="Ej: Este análisis es para un cliente del rubro inmobiliario. Destacar el crecimiento comercial de la zona."
                            className="w-full bg-gray-700 border border-gray-600 text-white text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-purple-500 resize-none placeholder-gray-500"
                          />
                        </div>
                        {publishStatus === 'success' && <p className="text-green-400 text-sm text-center">✅ Enviado a Make.com</p>}
                        {publishStatus === 'error' && <p className="text-red-400 text-sm text-center">❌ Error al publicar</p>}
                        <button
                          onClick={handlePublicar}
                          disabled={isPublishing}
                          className="w-full py-3 rounded-xl font-bold text-white text-sm transition-all disabled:opacity-60"
                          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                        >
                          {isPublishing ? '⏳ Publicando...' : '🚀 Publicar vía Make'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {!result && step < 4 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gray-800 rounded-xl p-8 border border-gray-700 border-dashed flex flex-col items-center justify-center gap-3 min-h-64">
                <span className="text-5xl">🗺️</span>
                <p className="text-gray-400 text-sm text-center">Configurá la zona y los períodos<br />para ver el análisis aquí</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
